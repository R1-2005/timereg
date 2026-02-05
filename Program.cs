using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using timereg.Data;
using timereg.Models;
using timereg.Repositories;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddScoped<ConsultantRepository>();
builder.Services.AddScoped<InvoiceProjectRepository>();
builder.Services.AddScoped<JiraProjectRepository>();
builder.Services.AddScoped<TimeEntryRepository>();
builder.Services.AddScoped<ReportRepository>();

var app = builder.Build();

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await dbInitializer.InitializeAsync();
}

app.UseDefaultFiles();
app.UseStaticFiles();

// API Routes
var api = app.MapGroup("/api");

// Login
api.MapPost("/login", async (LoginRequest request, ConsultantRepository repo) =>
{
    var consultant = await repo.GetByFirstNameAndEmailAsync(request.FirstName, request.Email);
    return consultant is not null ? Results.Ok(consultant) : Results.Unauthorized();
});

// Consultants
var consultants = api.MapGroup("/consultants");

consultants.MapGet("/", async (ConsultantRepository repo) =>
    Results.Ok(await repo.GetAllAsync()));

consultants.MapGet("/{id:int}", async (int id, ConsultantRepository repo) =>
{
    var consultant = await repo.GetByIdAsync(id);
    return consultant is not null ? Results.Ok(consultant) : Results.NotFound();
});

consultants.MapPost("/", async (Consultant consultant, ConsultantRepository repo) =>
{
    var created = await repo.CreateAsync(consultant);
    return Results.Created($"/api/consultants/{created.Id}", created);
});

consultants.MapPut("/{id:int}", async (int id, Consultant consultant, ConsultantRepository repo) =>
{
    consultant.Id = id;
    var updated = await repo.UpdateAsync(consultant);
    return updated is not null ? Results.Ok(updated) : Results.NotFound();
});

consultants.MapDelete("/{id:int}", async (int id, ConsultantRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

// Invoice Projects
api.MapGet("/invoice-projects", async (InvoiceProjectRepository repo) =>
    Results.Ok(await repo.GetAllAsync()));

// Jira Projects
var jiraProjects = api.MapGroup("/jira-projects");

jiraProjects.MapGet("/", async (JiraProjectRepository repo) =>
    Results.Ok(await repo.GetAllWithDistributionKeysAsync()));

jiraProjects.MapGet("/{id:int}", async (int id, JiraProjectRepository repo) =>
{
    var project = await repo.GetByIdWithDistributionKeysAsync(id);
    return project is not null ? Results.Ok(project) : Results.NotFound();
});

jiraProjects.MapPost("/", async (JiraProjectCreateDto dto, JiraProjectRepository repo) =>
{
    var sum = dto.DistributionKeys.Sum(dk => dk.Percentage);
    if (sum != 100)
        return Results.BadRequest(new { error = $"Distribution key percentages must sum to 100, got {sum}" });

    var created = await repo.CreateAsync(dto);
    return Results.Created($"/api/jira-projects/{created.Id}", created);
});

jiraProjects.MapPut("/{id:int}", async (int id, JiraProjectCreateDto dto, JiraProjectRepository repo) =>
{
    var sum = dto.DistributionKeys.Sum(dk => dk.Percentage);
    if (sum != 100)
        return Results.BadRequest(new { error = $"Distribution key percentages must sum to 100, got {sum}" });

    var updated = await repo.UpdateAsync(id, dto);
    return updated is not null ? Results.Ok(updated) : Results.NotFound();
});

jiraProjects.MapDelete("/{id:int}", async (int id, JiraProjectRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

// Time Entries
var timeEntries = api.MapGroup("/time-entries");

timeEntries.MapGet("/", async (int consultantId, int year, int month, TimeEntryRepository repo) =>
    Results.Ok(await repo.GetByConsultantAndMonthAsync(consultantId, year, month)));

timeEntries.MapPut("/", async (TimeEntryUpsertDto dto, TimeEntryRepository timeRepo, JiraProjectRepository jiraRepo) =>
{
    // Extract project key from issue key (e.g., "AFP" from "AFP-123")
    var dashIndex = dto.JiraIssueKey.LastIndexOf('-');
    if (dashIndex <= 0)
        return Results.BadRequest(new { error = "Invalid Jira issue key format. Expected format: PROJECT-123" });

    var projectKey = dto.JiraIssueKey[..dashIndex];
    var jiraProject = await jiraRepo.GetByKeyAsync(projectKey);

    if (jiraProject is null)
        return Results.BadRequest(new { error = $"Unknown Jira project key: {projectKey}" });

    var entry = new TimeEntry
    {
        ConsultantId = dto.ConsultantId,
        JiraIssueKey = dto.JiraIssueKey,
        JiraProjectId = jiraProject.Id,
        Date = dto.Date,
        Hours = dto.Hours
    };

    var result = await timeRepo.UpsertAsync(entry);
    return Results.Ok(result);
});

timeEntries.MapDelete("/{id:int}", async (int id, TimeEntryRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

timeEntries.MapDelete("/by-issue", async (int consultantId, string jiraIssueKey, int year, int month, TimeEntryRepository repo) =>
{
    var rowsDeleted = await repo.DeleteByConsultantAndIssueAsync(consultantId, jiraIssueKey, year, month);
    return Results.Ok(new { deleted = rowsDeleted });
});

// Monthly summary
api.MapGet("/monthly-summary", async (int year, int month, TimeEntryRepository repo) =>
    Results.Ok(await repo.GetMonthlySummaryAsync(year, month)));

// Reports
var reports = api.MapGroup("/reports");

reports.MapGet("/monthly", async (int year, int month, ReportRepository repo) =>
    Results.Ok(await repo.GetMonthlyReportAsync(year, month)));

reports.MapGet("/monthly/excel", async (int year, int month, int invoiceProjectId, ReportRepository repo, InvoiceProjectRepository ipRepo) =>
{
    var data = await repo.GetMonthlyReportAsync(year, month);
    var projectData = data.Where(r => r.InvoiceProjectId == invoiceProjectId).ToList();

    var invoiceProject = (await ipRepo.GetAllAsync()).FirstOrDefault(ip => ip.Id == invoiceProjectId);
    if (invoiceProject == null)
        return Results.NotFound();

    using var workbook = new XLWorkbook();
    var worksheet = workbook.Worksheets.Add("Fakturering");

    // Header
    var monthNames = new[] { "", "Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember" };
    worksheet.Cell(1, 1).Value = $"{invoiceProject.ProjectNumber} {invoiceProject.Name}";
    worksheet.Cell(1, 1).Style.Font.Bold = true;
    worksheet.Cell(1, 1).Style.Font.FontSize = 14;
    worksheet.Cell(2, 1).Value = $"{monthNames[month]} {year}";

    // Column headers
    worksheet.Cell(4, 1).Value = "Konsulent";
    worksheet.Cell(4, 2).Value = "Jira-sak";
    worksheet.Cell(4, 3).Value = "Timer";
    worksheet.Range(4, 1, 4, 3).Style.Font.Bold = true;
    worksheet.Range(4, 1, 4, 3).Style.Border.BottomBorder = XLBorderStyleValues.Thin;

    var row = 5;
    var currentConsultant = "";
    var consultantTotal = 0.0;
    var grandTotal = 0.0;

    foreach (var entry in projectData)
    {
        var consultantName = $"{entry.FirstName} {entry.LastName}";

        if (currentConsultant != "" && currentConsultant != consultantName)
        {
            // Sum row for previous consultant
            worksheet.Cell(row, 1).Value = $"Sum {currentConsultant}";
            worksheet.Cell(row, 1).Style.Font.Italic = true;
            worksheet.Cell(row, 3).Value = consultantTotal;
            worksheet.Cell(row, 3).Style.Font.Italic = true;
            worksheet.Cell(row, 3).Style.NumberFormat.Format = "0.00";
            row++;
            row++; // Empty row
            consultantTotal = 0;
        }

        currentConsultant = consultantName;
        worksheet.Cell(row, 1).Value = consultantName;
        worksheet.Cell(row, 2).Value = entry.JiraIssueKey;
        worksheet.Cell(row, 3).Value = entry.Hours;
        worksheet.Cell(row, 3).Style.NumberFormat.Format = "0.00";

        consultantTotal += entry.Hours;
        grandTotal += entry.Hours;
        row++;
    }

    // Last consultant sum
    if (currentConsultant != "")
    {
        worksheet.Cell(row, 1).Value = $"Sum {currentConsultant}";
        worksheet.Cell(row, 1).Style.Font.Italic = true;
        worksheet.Cell(row, 3).Value = consultantTotal;
        worksheet.Cell(row, 3).Style.Font.Italic = true;
        worksheet.Cell(row, 3).Style.NumberFormat.Format = "0.00";
        row++;
    }

    // Grand total
    row++;
    worksheet.Cell(row, 1).Value = "TOTALT";
    worksheet.Cell(row, 1).Style.Font.Bold = true;
    worksheet.Cell(row, 3).Value = grandTotal;
    worksheet.Cell(row, 3).Style.Font.Bold = true;
    worksheet.Cell(row, 3).Style.NumberFormat.Format = "0.00";

    worksheet.Columns().AdjustToContents();

    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    stream.Position = 0;

    var fileName = $"Fakturering_{invoiceProject.ProjectNumber}_{year}-{month:D2}.xlsx";
    return Results.File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
});

reports.MapGet("/monthly/pdf", async (int year, int month, int invoiceProjectId, ReportRepository repo, InvoiceProjectRepository ipRepo) =>
{
    var data = await repo.GetMonthlyReportAsync(year, month);
    var projectData = data.Where(r => r.InvoiceProjectId == invoiceProjectId).ToList();

    var invoiceProject = (await ipRepo.GetAllAsync()).FirstOrDefault(ip => ip.Id == invoiceProjectId);
    if (invoiceProject == null)
        return Results.NotFound();

    var monthNames = new[] { "", "Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember" };

    var document = Document.Create(container =>
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(40);
            page.DefaultTextStyle(x => x.FontSize(10));

            page.Header().Column(col =>
            {
                col.Item().Text($"{invoiceProject.ProjectNumber} {invoiceProject.Name}")
                    .FontSize(16).Bold();
                col.Item().Text($"{monthNames[month]} {year}")
                    .FontSize(12);
                col.Item().PaddingBottom(20);
            });

            page.Content().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(3);
                    columns.RelativeColumn(2);
                    columns.RelativeColumn(1);
                });

                // Header
                table.Header(header =>
                {
                    header.Cell().BorderBottom(1).Padding(5).Text("Konsulent").Bold();
                    header.Cell().BorderBottom(1).Padding(5).Text("Jira-sak").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Timer").Bold();
                });

                var currentConsultant = "";
                var consultantTotal = 0.0;
                var grandTotal = 0.0;

                foreach (var entry in projectData)
                {
                    var consultantName = $"{entry.FirstName} {entry.LastName}";

                    if (currentConsultant != "" && currentConsultant != consultantName)
                    {
                        // Sum row for previous consultant
                        table.Cell().Padding(5).Text($"Sum {currentConsultant}").Italic();
                        table.Cell().Padding(5).Text("");
                        table.Cell().Padding(5).AlignRight().Text(consultantTotal.ToString("0.00")).Italic();

                        // Empty row
                        table.Cell().Padding(5).Text("");
                        table.Cell().Padding(5).Text("");
                        table.Cell().Padding(5).Text("");

                        consultantTotal = 0;
                    }

                    currentConsultant = consultantName;
                    table.Cell().Padding(5).Text(consultantName);
                    table.Cell().Padding(5).Text(entry.JiraIssueKey);
                    table.Cell().Padding(5).AlignRight().Text(entry.Hours.ToString("0.00"));

                    consultantTotal += entry.Hours;
                    grandTotal += entry.Hours;
                }

                // Last consultant sum
                if (currentConsultant != "")
                {
                    table.Cell().Padding(5).Text($"Sum {currentConsultant}").Italic();
                    table.Cell().Padding(5).Text("");
                    table.Cell().Padding(5).AlignRight().Text(consultantTotal.ToString("0.00")).Italic();
                }

                // Empty row before grand total
                table.Cell().Padding(5).Text("");
                table.Cell().Padding(5).Text("");
                table.Cell().Padding(5).Text("");

                // Grand total
                table.Cell().BorderTop(1).Padding(5).Text("TOTALT").Bold();
                table.Cell().BorderTop(1).Padding(5).Text("");
                table.Cell().BorderTop(1).Padding(5).AlignRight().Text(grandTotal.ToString("0.00")).Bold();
            });
        });
    });

    var pdfBytes = document.GeneratePdf();
    var fileName = $"Fakturering_{invoiceProject.ProjectNumber}_{year}-{month:D2}.pdf";
    return Results.File(pdfBytes, "application/pdf", fileName);
});

app.Run();
