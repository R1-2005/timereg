using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class SectionRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public SectionRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Section>> GetAllAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<Section>(
            "SELECT * FROM Sections ORDER BY Id");
    }
}
