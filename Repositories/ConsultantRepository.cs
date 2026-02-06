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
        return await connection.QueryAsync<Consultant>("SELECT * FROM Consultants ORDER BY LastName, FirstName");
    }

    public async Task<Consultant?> GetByIdAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Consultant>(
            "SELECT * FROM Consultants WHERE Id = @Id", new { Id = id });
    }

    public async Task<Consultant?> GetByFirstNameAndEmailAsync(string firstName, string email)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Consultant>(
            "SELECT * FROM Consultants WHERE FirstName = @FirstName AND Email = @Email",
            new { FirstName = firstName, Email = email });
    }

    public async Task<Consultant> CreateAsync(Consultant consultant)
    {
        using var connection = _connectionFactory.CreateConnection();
        var id = await connection.ExecuteScalarAsync<int>(
            """
            INSERT INTO Consultants (FirstName, LastName, Email, IsAdmin, CanRegisterHours, EmployedFrom, EmployedTo)
            VALUES (@FirstName, @LastName, @Email, @IsAdmin, @CanRegisterHours, @EmployedFrom, @EmployedTo);
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
                IsAdmin = @IsAdmin, CanRegisterHours = @CanRegisterHours, EmployedFrom = @EmployedFrom, EmployedTo = @EmployedTo
            WHERE Id = @Id
            """, consultant);
        return rowsAffected > 0 ? consultant : null;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM Consultants WHERE Id = @Id", new { Id = id });
        return rowsAffected > 0;
    }
}
