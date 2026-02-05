namespace timereg.Models;

public class DistributionKey
{
    public int Id { get; set; }
    public int JiraProjectId { get; set; }
    public int InvoiceProjectId { get; set; }
    public decimal Percentage { get; set; }
}
