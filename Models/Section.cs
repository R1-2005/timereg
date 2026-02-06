namespace timereg.Models;

public class Section
{
    public int Id { get; set; }
    public required string Name { get; set; }
}

public class SectionDistributionKey
{
    public int Id { get; set; }
    public int JiraProjectId { get; set; }
    public int SectionId { get; set; }
    public decimal Percentage { get; set; }
}
