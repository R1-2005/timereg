using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class InvoiceProjectRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public InvoiceProjectRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<InvoiceProject>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<InvoiceProject>(
            "SELECT * FROM InvoiceProjects ORDER BY ProjectNumber");
    }

    public async Task<InvoiceProject?> GetByIdAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<InvoiceProject>(
            "SELECT * FROM InvoiceProjects WHERE Id = @Id", new { Id = id });
    }
}
