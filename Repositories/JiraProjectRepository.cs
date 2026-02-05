using Dapper;
using timereg.Data;
using timereg.Models;

namespace timereg.Repositories;

public class JiraProjectRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public JiraProjectRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<JiraProjectDto>> GetAllWithDistributionKeysAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        var jiraProjects = (await connection.QueryAsync<JiraProject>(
            "SELECT * FROM JiraProjects ORDER BY Key")).ToList();

        var distributionKeys = (await connection.QueryAsync<DistributionKey>(
            "SELECT * FROM DistributionKeys")).ToList();

        return jiraProjects.Select(jp => new JiraProjectDto
        {
            Id = jp.Id,
            Key = jp.Key,
            Name = jp.Name,
            DistributionKeys = distributionKeys
                .Where(dk => dk.JiraProjectId == jp.Id)
                .Select(dk => new DistributionKeyDto
                {
                    InvoiceProjectId = dk.InvoiceProjectId,
                    Percentage = dk.Percentage
                })
                .ToList()
        });
    }

    public async Task<JiraProjectDto?> GetByIdWithDistributionKeysAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();

        var jiraProject = await connection.QuerySingleOrDefaultAsync<JiraProject>(
            "SELECT * FROM JiraProjects WHERE Id = @Id", new { Id = id });

        if (jiraProject == null)
            return null;

        var distributionKeys = await connection.QueryAsync<DistributionKey>(
            "SELECT * FROM DistributionKeys WHERE JiraProjectId = @JiraProjectId",
            new { JiraProjectId = id });

        return new JiraProjectDto
        {
            Id = jiraProject.Id,
            Key = jiraProject.Key,
            Name = jiraProject.Name,
            DistributionKeys = distributionKeys
                .Select(dk => new DistributionKeyDto
                {
                    InvoiceProjectId = dk.InvoiceProjectId,
                    Percentage = dk.Percentage
                })
                .ToList()
        };
    }

    public async Task<JiraProject?> GetByKeyAsync(string key)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<JiraProject>(
            "SELECT * FROM JiraProjects WHERE Key = @Key", new { Key = key });
    }

    public async Task<JiraProjectDto> CreateAsync(JiraProjectCreateDto dto)
    {
        using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        using var transaction = connection.BeginTransaction();
        try
        {
            var id = await connection.ExecuteScalarAsync<int>(
                """
                INSERT INTO JiraProjects (Key, Name)
                VALUES (@Key, @Name);
                SELECT last_insert_rowid()
                """, new { dto.Key, dto.Name }, transaction);

            foreach (var dk in dto.DistributionKeys)
            {
                await connection.ExecuteAsync(
                    """
                    INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
                    VALUES (@JiraProjectId, @InvoiceProjectId, @Percentage)
                    """, new { JiraProjectId = id, dk.InvoiceProjectId, dk.Percentage }, transaction);
            }

            transaction.Commit();

            return new JiraProjectDto
            {
                Id = id,
                Key = dto.Key,
                Name = dto.Name,
                DistributionKeys = dto.DistributionKeys
            };
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<JiraProjectDto?> UpdateAsync(int id, JiraProjectCreateDto dto)
    {
        using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        using var transaction = connection.BeginTransaction();
        try
        {
            var rowsAffected = await connection.ExecuteAsync(
                """
                UPDATE JiraProjects
                SET Key = @Key, Name = @Name
                WHERE Id = @Id
                """, new { Id = id, dto.Key, dto.Name }, transaction);

            if (rowsAffected == 0)
            {
                transaction.Rollback();
                return null;
            }

            await connection.ExecuteAsync(
                "DELETE FROM DistributionKeys WHERE JiraProjectId = @JiraProjectId",
                new { JiraProjectId = id }, transaction);

            foreach (var dk in dto.DistributionKeys)
            {
                await connection.ExecuteAsync(
                    """
                    INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
                    VALUES (@JiraProjectId, @InvoiceProjectId, @Percentage)
                    """, new { JiraProjectId = id, dk.InvoiceProjectId, dk.Percentage }, transaction);
            }

            transaction.Commit();

            return new JiraProjectDto
            {
                Id = id,
                Key = dto.Key,
                Name = dto.Name,
                DistributionKeys = dto.DistributionKeys
            };
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rowsAffected = await connection.ExecuteAsync(
            "DELETE FROM JiraProjects WHERE Id = @Id", new { Id = id });
        return rowsAffected > 0;
    }
}
