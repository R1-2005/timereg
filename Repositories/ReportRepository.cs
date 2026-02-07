using Dapper;
using timereg.Data;

namespace timereg.Repositories;

public class ReportRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public ReportRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<MonthlyReportRow>> GetMonthlyReportAsync(int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var startDate = new DateOnly(year, month, 1).ToString("yyyy-MM-dd");
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month)).ToString("yyyy-MM-dd");

        return await connection.QueryAsync<MonthlyReportRow>(
            """
            SELECT
                ip.Id AS InvoiceProjectId,
                ip.ProjectNumber,
                ip.Name AS InvoiceProjectName,
                c.Id AS ConsultantId,
                c.FirstName,
                c.LastName,
                c.EmployerId,
                te.JiraIssueKey,
                CAST(SUM(te.Hours * dk.Percentage / 100.0) AS REAL) AS Hours
            FROM TimeEntries te
            INNER JOIN Consultants c ON c.Id = te.ConsultantId
            INNER JOIN DistributionKeys dk ON dk.JiraProjectId = te.JiraProjectId
            INNER JOIN InvoiceProjects ip ON ip.Id = dk.InvoiceProjectId
            WHERE te.Date >= @StartDate AND te.Date <= @EndDate
                AND c.EmployedFrom IS NOT NULL
                AND c.EmployedFrom <= @EndDate
                AND (c.EmployedTo IS NULL OR c.EmployedTo >= @StartDate)
            GROUP BY ip.Id, c.Id, te.JiraIssueKey
            HAVING SUM(te.Hours * dk.Percentage / 100.0) > 0
            ORDER BY ip.ProjectNumber, c.FirstName, c.LastName, te.JiraIssueKey
            """, new { StartDate = startDate, EndDate = endDate });
    }

    public class MonthlyReportRow
    {
        public int InvoiceProjectId { get; set; }
        public string ProjectNumber { get; set; } = "";
        public string InvoiceProjectName { get; set; } = "";
        public int ConsultantId { get; set; }
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public int EmployerId { get; set; }
        public string JiraIssueKey { get; set; } = "";
        public double Hours { get; set; }
    }
}
