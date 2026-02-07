using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class ConsultantRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public ConsultantRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Consultant>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<Consultant>(
            "SELECT c.*, e.Name AS EmployerName FROM Consultants c LEFT JOIN Employers e ON c.EmployerId = e.Id ORDER BY c.LastName, c.FirstName");
    }

    public async Task<Consultant?> GetByIdAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Consultant>(
            "SELECT c.*, e.Name AS EmployerName FROM Consultants c LEFT JOIN Employers e ON c.EmployerId = e.Id WHERE c.Id = @Id", new { Id = id });
    }

    public async Task<Consultant?> GetByFirstNameAndEmailAsync(string firstName, string email)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Consultant>(
            "SELECT c.*, e.Name AS EmployerName FROM Consultants c LEFT JOIN Employers e ON c.EmployerId = e.Id WHERE c.FirstName = @FirstName AND c.Email = @Email",
            new { FirstName = firstName, Email = email });
    }

    public async Task<Consultant> CreateAsync(Consultant consultant)
    {
        using var connection = _connectionFactory.CreateConnection();
        var id = await connection.ExecuteScalarAsync<int>(
            """
            INSERT INTO Consultants (FirstName, LastName, Email, IsAdmin, CanRegisterHours, IsActive, EmployedFrom, EmployedTo, EmployerId)
            VALUES (@FirstName, @LastName, @Email, @IsAdmin, @CanRegisterHours, @IsActive, @EmployedFrom, @EmployedTo, @EmployerId);
            SELECT last_insert_rowid()
            """, consultant);
        consultant.Id = id;
        return consultant;
    }

    public async Task<Consultant?> UpdateAsync(Consultant consultant)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            """
            UPDATE Consultants
            SET FirstName = @FirstName, LastName = @LastName, Email = @Email,
                IsAdmin = @IsAdmin, CanRegisterHours = @CanRegisterHours, IsActive = @IsActive,
                EmployedFrom = @EmployedFrom, EmployedTo = @EmployedTo, EmployerId = @EmployerId
            WHERE Id = @Id
            """, consultant);
        return rowsAffected > 0 ? consultant : null;
    }

    public async Task<bool> HasTimeEntriesAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM TimeEntries WHERE ConsultantId = @Id LIMIT 1", new { Id = id }) > 0;
    }

    public async Task<IEnumerable<int>> GetIdsWithTimeEntriesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<int>(
            "SELECT DISTINCT ConsultantId FROM TimeEntries");
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM Consultants WHERE Id = @Id", new { Id = id });
        return rowsAffected > 0;
    }
}
