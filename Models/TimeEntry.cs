namespace timereg.Models;

public class TimeEntry
{
    public int Id { get; set; }
    public int ConsultantId { get; set; }
    public required string JiraIssueKey { get; set; }
    public int JiraProjectId { get; set; }
    public DateOnly Date { get; set; }
    public decimal Hours { get; set; }
}
