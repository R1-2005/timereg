namespace timereg.Models;

public class Employer
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string OrgNumber { get; set; }
    public required string EmailDomain { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
}
