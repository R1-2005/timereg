namespace timereg.Models;

public class Consultant
{
    public int Id { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Email { get; set; }
    public bool IsAdmin { get; set; }
    public bool CanRegisterHours { get; set; }
    public string? EmployedFrom { get; set; }
    public string? EmployedTo { get; set; }
}
