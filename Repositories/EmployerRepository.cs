using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class EmployerRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public EmployerRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Employer>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<Employer>("SELECT * FROM Employers ORDER BY Name");
    }

    public async Task<Employer?> GetByIdAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Employer>(
            "SELECT * FROM Employers WHERE Id = @Id", new { Id = id });
    }

    public async Task<Employer?> GetByEmailDomainAsync(string domain)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Employer>(
            "SELECT * FROM Employers WHERE LOWER(EmailDomain) = LOWER(@Domain)",
            new { Domain = domain });
    }

    public async Task<Employer> CreateAsync(Employer employer)
    {
        using var connection = _connectionFactory.CreateConnection();
        var id = await connection.ExecuteScalarAsync<int>(
            """
            INSERT INTO Employers (Name, OrgNumber, EmailDomain, Address, PostalCode, City)
            VALUES (@Name, @OrgNumber, @EmailDomain, @Address, @PostalCode, @City);
            SELECT last_insert_rowid()
            """, employer);
        employer.Id = id;
        return employer;
    }

    public async Task<Employer?> UpdateAsync(Employer employer)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            """
            UPDATE Employers
            SET Name = @Name, OrgNumber = @OrgNumber, EmailDomain = @EmailDomain,
                Address = @Address, PostalCode = @PostalCode, City = @City
            WHERE Id = @Id
            """, employer);
        return rowsAffected > 0 ? employer : null;
    }

    public async Task<bool> HasConsultantsAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM Consultants WHERE EmployerId = @Id LIMIT 1", new { Id = id }) > 0;
    }

    public async Task<IEnumerable<int>> GetIdsWithConsultantsAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<int>(
            "SELECT DISTINCT EmployerId FROM Consultants WHERE EmployerId IS NOT NULL");
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM Employers WHERE Id = @Id", new { Id = id });
        return rowsAffected > 0;
    }
}
