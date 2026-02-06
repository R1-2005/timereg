namespace timereg.Models;

public class LoginRequest
{
    public required string FirstName { get; set; }
    public required string Email { get; set; }
}

public class DistributionKeyDto
{
    public int InvoiceProjectId { get; set; }
    public decimal Percentage { get; set; }
}

public class SectionDistributionKeyDto
{
    public int SectionId { get; set; }
    public decimal Percentage { get; set; }
}

public class JiraProjectDto
{
    public int Id { get; set; }
    public required string Key { get; set; }
    public required string Name { get; set; }
    public required List<DistributionKeyDto> DistributionKeys { get; set; }
    public required List<SectionDistributionKeyDto> SectionDistributionKeys { get; set; }
}

public class JiraProjectCreateDto
{
    public required string Key { get; set; }
    public required string Name { get; set; }
    public required List<DistributionKeyDto> DistributionKeys { get; set; }
    public required List<SectionDistributionKeyDto> SectionDistributionKeys { get; set; }
}

public class JiraProjectImportDto
{
    public required List<JiraProjectCreateDto> Projects { get; set; }
}

public class TimeEntryUpsertDto
{
    public int ConsultantId { get; set; }
    public required string JiraIssueKey { get; set; }
    public DateOnly Date { get; set; }
    public decimal Hours { get; set; }
}

public class TimeEntryImportDto
{
    public int ConsultantId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public required List<TimeEntryImportItem> Entries { get; set; }
}

public class TimeEntryImportItem
{
    public required string JiraIssueKey { get; set; }
    public DateOnly Date { get; set; }
    public decimal Hours { get; set; }
}

public class MonthlyLockToggleDto
{
    public int ConsultantId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public bool Locked { get; set; }
}
