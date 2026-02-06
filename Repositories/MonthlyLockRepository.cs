using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class MonthlyLockRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public MonthlyLockRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<MonthlyLock?> GetAsync(int consultantId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<MonthlyLock>(
            "SELECT * FROM MonthlyLocks WHERE ConsultantId = @ConsultantId AND Year = @Year AND Month = @Month",
            new { ConsultantId = consultantId, Year = year, Month = month });
    }

    public async Task<IEnumerable<MonthlyLock>> GetByMonthAsync(int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<MonthlyLock>(
            "SELECT * FROM MonthlyLocks WHERE Year = @Year AND Month = @Month",
            new { Year = year, Month = month });
    }

    public async Task<bool> IsLockedAsync(int consultantId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var count = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM MonthlyLocks WHERE ConsultantId = @ConsultantId AND Year = @Year AND Month = @Month",
            new { ConsultantId = consultantId, Year = year, Month = month });
        return count > 0;
    }

    public async Task<MonthlyLock> LockAsync(int consultantId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var lockedAt = DateTime.UtcNow.ToString("o");
        var id = await connection.ExecuteScalarAsync<int>(
            """
            INSERT INTO MonthlyLocks (ConsultantId, Year, Month, LockedAt)
            VALUES (@ConsultantId, @Year, @Month, @LockedAt);
            SELECT last_insert_rowid()
            """, new { ConsultantId = consultantId, Year = year, Month = month, LockedAt = lockedAt });

        return new MonthlyLock
        {
            Id = id,
            ConsultantId = consultantId,
            Year = year,
            Month = month,
            LockedAt = lockedAt
        };
    }

    public async Task<bool> UnlockAsync(int consultantId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM MonthlyLocks WHERE ConsultantId = @ConsultantId AND Year = @Year AND Month = @Month",
            new { ConsultantId = consultantId, Year = year, Month = month });
        return rowsAffected > 0;
    }
}
