namespace timereg.Models;

public class MonthlyLock
{
    public int Id { get; set; }
    public int ConsultantId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string LockedAt { get; set; } = "";
}
