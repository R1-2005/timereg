using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class TimeEntryRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public TimeEntryRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<TimeEntry>> GetByConsultantAndMonthAsync(int consultantId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();

        var startDate = new DateOnly(year, month, 1).ToString("yyyy-MM-dd");
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month)).ToString("yyyy-MM-dd");

        var results = await connection.QueryAsync<TimeEntryRow>(
            """
            SELECT Id, ConsultantId, JiraIssueKey, JiraProjectId, Date, Hours
            FROM TimeEntries
            WHERE ConsultantId = @ConsultantId
              AND Date >= @StartDate
              AND Date <= @EndDate
            ORDER BY Date, JiraIssueKey
            """, new { ConsultantId = consultantId, StartDate = startDate, EndDate = endDate });

        return results.Select(r => new TimeEntry
        {
            Id = r.Id,
            ConsultantId = r.ConsultantId,
            JiraIssueKey = r.JiraIssueKey,
            JiraProjectId = r.JiraProjectId,
            Date = DateOnly.Parse(r.Date),
            Hours = r.Hours
        });
    }

    public async Task<TimeEntry?> GetByIdAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();

        var result = await connection.QuerySingleOrDefaultAsync<TimeEntryRow>(
            "SELECT Id, ConsultantId, JiraIssueKey, JiraProjectId, Date, Hours FROM TimeEntries WHERE Id = @Id",
            new { Id = id });

        if (result == null)
            return null;

        return new TimeEntry
        {
            Id = result.Id,
            ConsultantId = result.ConsultantId,
            JiraIssueKey = result.JiraIssueKey,
            JiraProjectId = result.JiraProjectId,
            Date = DateOnly.Parse(result.Date),
            Hours = result.Hours
        };
    }

    public async Task<TimeEntry> UpsertAsync(TimeEntry entry)
    {
        using var connection = _connectionFactory.CreateConnection();
        var dateString = entry.Date.ToString("yyyy-MM-dd");

        var existingId = await connection.ExecuteScalarAsync<int?>(
            """
            SELECT Id FROM TimeEntries
            WHERE ConsultantId = @ConsultantId
              AND JiraIssueKey = @JiraIssueKey
              AND Date = @Date
            """, new { entry.ConsultantId, entry.JiraIssueKey, Date = dateString });

        if (existingId.HasValue)
        {
            await connection.ExecuteAsync(
                """
                UPDATE TimeEntries
                SET Hours = @Hours, JiraProjectId = @JiraProjectId
                WHERE Id = @Id
                """, new { Id = existingId.Value, entry.Hours, entry.JiraProjectId });
            entry.Id = existingId.Value;
        }
        else
        {
            var id = await connection.ExecuteScalarAsync<int>(
                """
                INSERT INTO TimeEntries (ConsultantId, JiraIssueKey, JiraProjectId, Date, Hours)
                VALUES (@ConsultantId, @JiraIssueKey, @JiraProjectId, @Date, @Hours);
                SELECT last_insert_rowid()
                """, new { entry.ConsultantId, entry.JiraIssueKey, entry.JiraProjectId, Date = dateString, entry.Hours });
            entry.Id = id;
        }

        return entry;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM TimeEntries WHERE Id = @Id", new { Id = id });
        return rowsAffected > 0;
    }

    public async Task<int> DeleteByConsultantAndIssueAsync(int consultantId, string jiraIssueKey, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var startDate = new DateOnly(year, month, 1).ToString("yyyy-MM-dd");
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month)).ToString("yyyy-MM-dd");

        var rowsAffected = await connection.ExecuteAsync(
            """
            DELETE FROM TimeEntries
            WHERE ConsultantId = @ConsultantId
              AND JiraIssueKey = @JiraIssueKey
              AND Date >= @StartDate
              AND Date <= @EndDate
            """, new { ConsultantId = consultantId, JiraIssueKey = jiraIssueKey, StartDate = startDate, EndDate = endDate });
        return rowsAffected;
    }

    public async Task<IEnumerable<MonthSummaryRow>> GetMonthlySummaryAsync(int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var startDate = new DateOnly(year, month, 1).ToString("yyyy-MM-dd");
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month)).ToString("yyyy-MM-dd");

        return await connection.QueryAsync<MonthSummaryRow>(
            """
            WITH ConsultantTotals AS (
                SELECT
                    c.Id AS ConsultantId,
                    c.FirstName,
                    c.LastName,
                    COALESCE(SUM(te.Hours), 0.0) AS TotalHours
                FROM Consultants c
                LEFT JOIN TimeEntries te ON te.ConsultantId = c.Id
                    AND te.Date >= @StartDate
                    AND te.Date <= @EndDate
                GROUP BY c.Id
            ),
            DistributedTotals AS (
                SELECT
                    te.ConsultantId,
                    dk.InvoiceProjectId,
                    COALESCE(SUM(te.Hours * dk.Percentage / 100.0), 0.0) AS DistributedHours
                FROM TimeEntries te
                INNER JOIN DistributionKeys dk ON dk.JiraProjectId = te.JiraProjectId
                WHERE te.Date >= @StartDate AND te.Date <= @EndDate
                GROUP BY te.ConsultantId, dk.InvoiceProjectId
            )
            SELECT
                ct.ConsultantId,
                ct.FirstName,
                ct.LastName,
                CAST(ct.TotalHours AS REAL) AS TotalHours,
                ip.Id AS InvoiceProjectId,
                ip.ProjectNumber,
                ip.Name AS InvoiceProjectName,
                CAST(COALESCE(dt.DistributedHours, 0.0) AS REAL) AS DistributedHours
            FROM ConsultantTotals ct
            CROSS JOIN InvoiceProjects ip
            LEFT JOIN DistributedTotals dt ON dt.ConsultantId = ct.ConsultantId
                AND dt.InvoiceProjectId = ip.Id
            ORDER BY ct.FirstName, ct.LastName, ip.ProjectNumber
            """, new { StartDate = startDate, EndDate = endDate });
    }

    public class MonthSummaryRow
    {
        public int ConsultantId { get; set; }
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public double TotalHours { get; set; }
        public int InvoiceProjectId { get; set; }
        public string ProjectNumber { get; set; } = "";
        public string InvoiceProjectName { get; set; } = "";
        public double DistributedHours { get; set; }
    }

    private class TimeEntryRow
    {
        public int Id { get; set; }
        public int ConsultantId { get; set; }
        public required string JiraIssueKey { get; set; }
        public int JiraProjectId { get; set; }
        public required string Date { get; set; }
        public decimal Hours { get; set; }
    }
}
