namespace timereg.Helpers;

public static class DateRange
{
    public static (string firstDay, string lastDay) ForMonth(int year, int month)
    {
        var firstDay = new DateOnly(year, month, 1).ToString("yyyy-MM-dd");
        var lastDay = new DateOnly(year, month, DateTime.DaysInMonth(year, month)).ToString("yyyy-MM-dd");
        return (firstDay, lastDay);
    }
}
