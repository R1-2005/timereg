using QuestPDF.Infrastructure;
using timereg.Data;
using timereg.Helpers;
using timereg.Models;
using timereg.Repositories;
using timereg.Services;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddScoped<ConsultantRepository>();
builder.Services.AddScoped<EmployerRepository>();
builder.Services.AddScoped<InvoiceProjectRepository>();
builder.Services.AddScoped<JiraProjectRepository>();
builder.Services.AddScoped<TimeEntryRepository>();
builder.Services.AddScoped<ReportRepository>();
builder.Services.AddScoped<SectionRepository>();
builder.Services.AddScoped<MonthlyLockRepository>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddHttpClient("NagerDate", client =>
{
    client.BaseAddress = new Uri("https://date.nager.at/api/v3/");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddSingleton<HolidayService>();
builder.Services.AddSingleton<DatabaseBackupService>();

var app = builder.Build();

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await dbInitializer.InitializeAsync();
}

// Pre-fetch holidays for current and next year
await app.Services.GetRequiredService<HolidayService>().PreloadAsync();

app.UseDefaultFiles();
app.UseStaticFiles();

// Validation helpers
static IResult? ValidateEmployer(Employer employer)
{
    if (string.IsNullOrWhiteSpace(employer.Name))
        return Results.BadRequest(new { error = "Navn er påkrevd." });

    if (string.IsNullOrWhiteSpace(employer.OrgNumber) || !System.Text.RegularExpressions.Regex.IsMatch(employer.OrgNumber, @"^\d{9}$"))
        return Results.BadRequest(new { error = "Organisasjonsnummer må være 9 siffer." });

    if (string.IsNullOrWhiteSpace(employer.EmailDomain))
        return Results.BadRequest(new { error = "E-postdomene er påkrevd." });

    return null;
}

static IResult? ValidateDistributionKeys(JiraProjectCreateDto dto)
{
    var sum = dto.DistributionKeys.Sum(dk => dk.Percentage);
    if (sum != 100)
        return Results.BadRequest(new { error = $"Distribution key percentages must sum to 100, got {sum}" });

    var sectionSum = dto.SectionDistributionKeys.Sum(sdk => sdk.Percentage);
    if (sectionSum != 100)
        return Results.BadRequest(new { error = $"Section distribution key percentages must sum to 100, got {sectionSum}" });

    return null;
}

// API Routes
var api = app.MapGroup("/api");

// Login
api.MapPost("/login", async (LoginRequest request, ConsultantRepository repo, EmployerRepository employerRepo) =>
{
    var atIndex = request.Email.LastIndexOf('@');
    if (atIndex <= 0)
        return Results.BadRequest(new { error = "Ugyldig e-postadresse." });

    var domain = request.Email[(atIndex + 1)..];
    var employer = await employerRepo.GetByEmailDomainAsync(domain);
    if (employer is null)
        return Results.BadRequest(new { error = "E-postdomenet er ikke knyttet til en registrert arbeidsgiver." });

    var consultant = await repo.GetByFirstNameAndEmailAsync(request.FirstName, request.Email);
    if (consultant is null)
        return Results.Unauthorized();
    if (!consultant.IsActive)
        return Results.BadRequest(new { error = "Brukeren er deaktivert. Kontakt administrator." });
    return Results.Ok(consultant);
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

consultants.MapPost("/", async (Consultant consultant, ConsultantRepository repo, EmployerRepository employerRepo) =>
{
    var employer = await employerRepo.GetByIdAsync(consultant.EmployerId);
    if (employer is null)
        return Results.BadRequest(new { error = "Ugyldig arbeidsgiver." });

    if (!consultant.Email.EndsWith($"@{employer.EmailDomain}", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = $"E-postadressen må slutte med @{employer.EmailDomain}." });

    var created = await repo.CreateAsync(consultant);
    return Results.Created($"/api/consultants/{created.Id}", created);
});

consultants.MapPut("/{id:int}", async (int id, Consultant consultant, ConsultantRepository repo, EmployerRepository employerRepo) =>
{
    var employer = await employerRepo.GetByIdAsync(consultant.EmployerId);
    if (employer is null)
        return Results.BadRequest(new { error = "Ugyldig arbeidsgiver." });

    if (!consultant.Email.EndsWith($"@{employer.EmailDomain}", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = $"E-postadressen må slutte med @{employer.EmailDomain}." });

    consultant.Id = id;
    var updated = await repo.UpdateAsync(consultant);
    return updated is not null ? Results.Ok(updated) : Results.NotFound();
});

consultants.MapGet("/with-time-entries", async (ConsultantRepository repo) =>
    Results.Ok(await repo.GetIdsWithTimeEntriesAsync()));

consultants.MapDelete("/{id:int}", async (int id, ConsultantRepository repo) =>
{
    if (await repo.HasTimeEntriesAsync(id))
        return Results.BadRequest(new { error = "Konsulenten har timeregistreringer og kan ikke slettes. Deaktiver brukeren i stedet." });

    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

// Employers
var employers = api.MapGroup("/employers");

employers.MapGet("/", async (EmployerRepository repo) =>
    Results.Ok(await repo.GetAllAsync()));

employers.MapGet("/with-consultants", async (EmployerRepository repo) =>
    Results.Ok(await repo.GetIdsWithConsultantsAsync()));

employers.MapGet("/{id:int}", async (int id, EmployerRepository repo) =>
{
    var employer = await repo.GetByIdAsync(id);
    return employer is not null ? Results.Ok(employer) : Results.NotFound();
});

employers.MapPost("/", async (Employer employer, EmployerRepository repo) =>
{
    var validationError = ValidateEmployer(employer);
    if (validationError is not null) return validationError;

    employer.EmailDomain = employer.EmailDomain.TrimStart('@').ToLower();

    var created = await repo.CreateAsync(employer);
    return Results.Created($"/api/employers/{created.Id}", created);
});

employers.MapPut("/{id:int}", async (int id, Employer employer, EmployerRepository repo) =>
{
    var validationError = ValidateEmployer(employer);
    if (validationError is not null) return validationError;

    employer.EmailDomain = employer.EmailDomain.TrimStart('@').ToLower();
    employer.Id = id;

    var updated = await repo.UpdateAsync(employer);
    return updated is not null ? Results.Ok(updated) : Results.NotFound();
});

employers.MapDelete("/{id:int}", async (int id, EmployerRepository repo) =>
{
    if (await repo.HasConsultantsAsync(id))
        return Results.BadRequest(new { error = "Arbeidsgiveren har konsulenter og kan ikke slettes." });

    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

// Invoice Projects
api.MapGet("/invoice-projects", async (InvoiceProjectRepository repo) =>
    Results.Ok(await repo.GetAllAsync()));

// Sections
api.MapGet("/sections", async (SectionRepository repo) =>
    Results.Ok(await repo.GetAllAsync()));

// Holidays
api.MapGet("/holidays", async (int year, HolidayService holidayService) =>
    Results.Ok(await holidayService.GetHolidaysAsync(year)));

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
    var validationError = ValidateDistributionKeys(dto);
    if (validationError is not null) return validationError;

    var created = await repo.CreateAsync(dto);
    return Results.Created($"/api/jira-projects/{created.Id}", created);
});

jiraProjects.MapPut("/{id:int}", async (int id, JiraProjectCreateDto dto, JiraProjectRepository repo) =>
{
    var validationError = ValidateDistributionKeys(dto);
    if (validationError is not null) return validationError;

    var updated = await repo.UpdateAsync(id, dto);
    return updated is not null ? Results.Ok(updated) : Results.NotFound();
});

jiraProjects.MapDelete("/{id:int}", async (int id, JiraProjectRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound();
});

jiraProjects.MapGet("/export", async (JiraProjectRepository repo) =>
{
    var projects = await repo.GetAllWithDistributionKeysAsync();
    var exportData = new
    {
        exportedAt = DateTime.UtcNow,
        projects = projects.Select(p => new
        {
            p.Key,
            p.Name,
            distributionKeys = p.DistributionKeys.Select(dk => new { dk.InvoiceProjectId, dk.Percentage }),
            sectionDistributionKeys = p.SectionDistributionKeys.Select(sdk => new { sdk.SectionId, sdk.Percentage })
        })
    };

    var json = System.Text.Json.JsonSerializer.Serialize(exportData, new System.Text.Json.JsonSerializerOptions
    {
        WriteIndented = true
    });

    return Results.File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", "JiraProsjekter.json");
});

jiraProjects.MapPost("/import", async (JiraProjectImportDto importData, JiraProjectRepository repo) =>
{
    var imported = 0;
    var updated = 0;
    var errors = new List<string>();

    foreach (var project in importData.Projects)
    {
        var validationError = ValidateDistributionKeys(project);
        if (validationError is not null)
        {
            var distSum = project.DistributionKeys.Sum(dk => dk.Percentage);
            var secSum = project.SectionDistributionKeys.Sum(sdk => sdk.Percentage);
            if (distSum != 100)
                errors.Add($"{project.Key}: Fordelingsnøkler summerer til {distSum}, ikke 100");
            else
                errors.Add($"{project.Key}: Seksjonsfordeling summerer til {secSum}, ikke 100");
            continue;
        }

        var dto = new JiraProjectCreateDto
        {
            Key = project.Key,
            Name = project.Name,
            DistributionKeys = project.DistributionKeys,
            SectionDistributionKeys = project.SectionDistributionKeys
        };

        var existing = await repo.GetByKeyAsync(project.Key);
        if (existing != null)
        {
            await repo.UpdateAsync(existing.Id, dto);
            updated++;
        }
        else
        {
            await repo.CreateAsync(dto);
            imported++;
        }
    }

    return Results.Ok(new { imported, updated, errors });
});

// Monthly Locks
var monthlyLocks = api.MapGroup("/monthly-locks");

monthlyLocks.MapGet("/", async (int consultantId, int year, int month, MonthlyLockRepository repo) =>
{
    var lockEntry = await repo.GetAsync(consultantId, year, month);
    return Results.Ok(new { isLocked = lockEntry is not null, lockedAt = lockEntry?.LockedAt });
});

monthlyLocks.MapPut("/", async (MonthlyLockToggleDto dto, MonthlyLockRepository repo) =>
{
    if (dto.Locked)
    {
        var existing = await repo.GetAsync(dto.ConsultantId, dto.Year, dto.Month);
        if (existing is not null)
            return Results.Ok(new { isLocked = true, lockedAt = existing.LockedAt });

        var lockEntry = await repo.LockAsync(dto.ConsultantId, dto.Year, dto.Month);
        return Results.Ok(new { isLocked = true, lockedAt = lockEntry.LockedAt });
    }
    else
    {
        await repo.UnlockAsync(dto.ConsultantId, dto.Year, dto.Month);
        return Results.Ok(new { isLocked = false, lockedAt = (string?)null });
    }
});

monthlyLocks.MapGet("/by-month", async (int year, int month, MonthlyLockRepository repo) =>
    Results.Ok(await repo.GetByMonthAsync(year, month)));

// Time Entries
var timeEntries = api.MapGroup("/time-entries");

timeEntries.MapGet("/", async (int consultantId, int year, int month, TimeEntryRepository repo) =>
    Results.Ok(await repo.GetByConsultantAndMonthAsync(consultantId, year, month)));

timeEntries.MapPut("/", async (TimeEntryUpsertDto dto, TimeEntryRepository timeRepo, JiraProjectRepository jiraRepo, MonthlyLockRepository lockRepo) =>
{
    // Check if month is locked
    if (await lockRepo.IsLockedAsync(dto.ConsultantId, dto.Date.Year, dto.Date.Month))
        return Results.BadRequest(new { error = "Måneden er låst. Lås opp timearket for å gjøre endringer." });

    // Extract project key from issue key (e.g., "AFP" from "AFP-123")
    var projectKey = JiraIssueKeyParser.ExtractProjectKey(dto.JiraIssueKey);
    if (projectKey is null)
        return Results.BadRequest(new { error = "Invalid Jira issue key format. Expected format: PROJECT-123" });

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

timeEntries.MapDelete("/{id:int}", async (int id, TimeEntryRepository repo, MonthlyLockRepository lockRepo) =>
{
    var entry = await repo.GetByIdAsync(id);
    if (entry is null)
        return Results.NotFound();

    if (await lockRepo.IsLockedAsync(entry.ConsultantId, entry.Date.Year, entry.Date.Month))
        return Results.BadRequest(new { error = "Måneden er låst. Lås opp timearket for å gjøre endringer." });

    await repo.DeleteAsync(id);
    return Results.NoContent();
});

timeEntries.MapDelete("/by-issue", async (int consultantId, string jiraIssueKey, int year, int month, TimeEntryRepository repo, MonthlyLockRepository lockRepo) =>
{
    if (await lockRepo.IsLockedAsync(consultantId, year, month))
        return Results.BadRequest(new { error = "Måneden er låst. Lås opp timearket for å gjøre endringer." });

    var rowsDeleted = await repo.DeleteByConsultantAndIssueAsync(consultantId, jiraIssueKey, year, month);
    return Results.Ok(new { deleted = rowsDeleted });
});

timeEntries.MapGet("/export", async (int consultantId, int year, int month, TimeEntryRepository repo) =>
{
    var entries = await repo.GetByConsultantAndMonthAsync(consultantId, year, month);
    var exportData = new
    {
        consultantId,
        year,
        month,
        exportedAt = DateTime.UtcNow,
        entries = entries.Select(e => new
        {
            jiraIssueKey = e.JiraIssueKey,
            date = e.Date.ToString("yyyy-MM-dd"),
            hours = e.Hours
        })
    };

    var json = System.Text.Json.JsonSerializer.Serialize(exportData, new System.Text.Json.JsonSerializerOptions
    {
        WriteIndented = true
    });

    var fileName = $"Timer_{year}-{month:D2}.json";
    return Results.File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", fileName);
});

timeEntries.MapGet("/export/excel", async (int consultantId, int year, int month, TimeEntryRepository timeRepo, ConsultantRepository consultantRepo, InvoiceProjectRepository ipRepo, JiraProjectRepository jiraRepo, ReportService reportService) =>
{
    var consultant = await consultantRepo.GetByIdAsync(consultantId);
    if (consultant is null)
        return Results.NotFound();

    var entries = await timeRepo.GetByConsultantAndMonthAsync(consultantId, year, month);
    var invoiceProjects = (await ipRepo.GetAllAsync()).ToList();
    var jiraProjectDtos = (await jiraRepo.GetAllWithDistributionKeysAsync()).ToList();
    var consultantName = $"{consultant.FirstName} {consultant.LastName}";
    var excelBytes = reportService.GenerateTimesheetExcel(consultantName, entries, invoiceProjects, jiraProjectDtos, year, month);

    var fileName = $"Timeark_{consultantName.Replace(" ", "_")}_{MonthNames.Norwegian[month]}_{year}.xlsx";
    return Results.File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
});

timeEntries.MapPost("/import", async (TimeEntryImportDto importData, TimeEntryRepository timeRepo, JiraProjectRepository jiraRepo, MonthlyLockRepository lockRepo) =>
{
    if (await lockRepo.IsLockedAsync(importData.ConsultantId, importData.Year, importData.Month))
        return Results.BadRequest(new { error = "Måneden er låst. Lås opp timearket for å gjøre endringer." });

    // Delete existing entries for this consultant/month
    await timeRepo.DeleteByConsultantAndMonthAsync(importData.ConsultantId, importData.Year, importData.Month);

    var imported = 0;
    var errors = new List<string>();

    foreach (var entry in importData.Entries)
    {
        var projectKey = JiraIssueKeyParser.ExtractProjectKey(entry.JiraIssueKey);
        if (projectKey is null)
        {
            errors.Add($"Ugyldig format: {entry.JiraIssueKey}");
            continue;
        }

        var jiraProject = await jiraRepo.GetByKeyAsync(projectKey);

        if (jiraProject is null)
        {
            errors.Add($"Ukjent prosjekt: {projectKey}");
            continue;
        }

        var timeEntry = new TimeEntry
        {
            ConsultantId = importData.ConsultantId,
            JiraIssueKey = entry.JiraIssueKey,
            JiraProjectId = jiraProject.Id,
            Date = entry.Date,
            Hours = entry.Hours
        };

        await timeRepo.UpsertAsync(timeEntry);
        imported++;
    }

    return Results.Ok(new { imported, errors });
});

// Monthly summary
api.MapGet("/monthly-summary", async (int year, int month, TimeEntryRepository repo) =>
    Results.Ok(await repo.GetMonthlySummaryAsync(year, month)));

// Reports
var reports = api.MapGroup("/reports");

reports.MapGet("/monthly", async (int year, int month, ReportRepository repo) =>
    Results.Ok(await repo.GetMonthlyReportAsync(year, month)));

reports.MapGet("/monthly/excel", async (int year, int month, int invoiceProjectId, int? employerId, ReportRepository repo, InvoiceProjectRepository ipRepo, SectionRepository sectionRepo, JiraProjectRepository jiraRepo, ReportService reportService) =>
{
    var data = await repo.GetMonthlyReportAsync(year, month);
    var projectData = data.Where(r => r.InvoiceProjectId == invoiceProjectId).ToList();
    if (employerId.HasValue)
        projectData = projectData.Where(r => r.EmployerId == employerId.Value).ToList();

    var invoiceProject = (await ipRepo.GetAllAsync()).FirstOrDefault(ip => ip.Id == invoiceProjectId);
    if (invoiceProject == null)
        return Results.NotFound();

    var sections = (await sectionRepo.GetAllAsync()).ToList();
    var jiraProjectDtos = (await jiraRepo.GetAllWithDistributionKeysAsync()).ToList();

    var excelBytes = reportService.GenerateExcel(invoiceProject, projectData, sections, jiraProjectDtos, year, month);

    var shortName = (invoiceProject.ShortName ?? invoiceProject.Name).Replace(" ", "_");
    var fileName = $"{shortName}_{MonthNames.Norwegian[month]}_{year}.xlsx";
    return Results.File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
});

reports.MapGet("/monthly/pdf", async (int year, int month, int invoiceProjectId, int? employerId, ReportRepository repo, InvoiceProjectRepository ipRepo, SectionRepository sectionRepo, JiraProjectRepository jiraRepo, EmployerRepository employerRepo, ReportService reportService) =>
{
    var data = await repo.GetMonthlyReportAsync(year, month);
    var projectData = data.Where(r => r.InvoiceProjectId == invoiceProjectId).ToList();
    if (employerId.HasValue)
        projectData = projectData.Where(r => r.EmployerId == employerId.Value).ToList();

    var invoiceProject = (await ipRepo.GetAllAsync()).FirstOrDefault(ip => ip.Id == invoiceProjectId);
    if (invoiceProject == null)
        return Results.NotFound();

    var employerName = "";
    if (employerId.HasValue)
    {
        var employer = await employerRepo.GetByIdAsync(employerId.Value);
        employerName = employer?.Name ?? "";
    }

    var sections = (await sectionRepo.GetAllAsync()).ToList();
    var jiraProjectDtos = (await jiraRepo.GetAllWithDistributionKeysAsync()).ToList();

    var pdfBytes = reportService.GeneratePdf(invoiceProject, employerName, projectData, sections, jiraProjectDtos, year, month);

    var shortName = (invoiceProject.ShortName ?? invoiceProject.Name).Replace(" ", "_");
    var fileName = $"{shortName}_{MonthNames.Norwegian[month]}_{year}.pdf";
    return Results.File(pdfBytes, "application/pdf", fileName);
});

// Database backup/restore
var database = api.MapGroup("/database");

database.MapGet("/status", async (DatabaseBackupService backupService) =>
    Results.Ok(await backupService.GetStatusAsync()));

database.MapPost("/backup", async (DatabaseBackupService backupService) =>
    Results.Ok(await backupService.CreateBackupAsync()));

database.MapGet("/backups", async (DatabaseBackupService backupService) =>
    Results.Ok(await backupService.GetBackupsAsync()));

database.MapPost("/restore", async (RestoreRequest request, DatabaseBackupService backupService) =>
{
    try
    {
        await backupService.RestoreAsync(request.Filename);
        return Results.Ok(new { message = "Database gjenopprettet." });
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { error = "Backup-filen finnes ikke." });
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

database.MapDelete("/backups/{filename}", (string filename, DatabaseBackupService backupService) =>
{
    try
    {
        backupService.DeleteBackup(filename);
        return Results.NoContent();
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { error = "Backup-filen finnes ikke." });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.Run();

record RestoreRequest(string Filename);
