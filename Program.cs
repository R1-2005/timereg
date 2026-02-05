using timereg.Data;
using timereg.Models;
using timereg.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<DatabaseInitializer>();
builder.Services.AddScoped<ConsultantRepository>();
builder.Services.AddScoped<InvoiceProjectRepository>();
builder.Services.AddScoped<JiraProjectRepository>();
builder.Services.AddScoped<TimeEntryRepository>();

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

app.Run();
