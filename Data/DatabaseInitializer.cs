using Dapper;
using Microsoft.Data.Sqlite;

namespace timereg.Data;

public class DatabaseInitializer
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(DbConnectionFactory connectionFactory, ILogger<DatabaseInitializer> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await EnsureMigrationsTableAsync(connection);
        await RunPendingMigrationsAsync(connection);
    }

    private async Task EnsureMigrationsTableAsync(SqliteConnection connection)
    {
        const string sql = """
            CREATE TABLE IF NOT EXISTS __migrations (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ScriptName TEXT NOT NULL UNIQUE,
                AppliedAt TEXT NOT NULL
            )
            """;
        await connection.ExecuteAsync(sql);
    }

    private async Task RunPendingMigrationsAsync(SqliteConnection connection)
    {
        var scriptsPath = Path.Combine(AppContext.BaseDirectory, "Scripts");
        if (!Directory.Exists(scriptsPath))
        {
            scriptsPath = Path.Combine(Directory.GetCurrentDirectory(), "Scripts");
        }

        if (!Directory.Exists(scriptsPath))
        {
            _logger.LogWarning("Scripts directory not found at {Path}", scriptsPath);
            return;
        }

        var scriptFiles = Directory.GetFiles(scriptsPath, "*.sql")
            .OrderBy(f => f)
            .ToList();

        foreach (var scriptFile in scriptFiles)
        {
            var scriptName = Path.GetFileName(scriptFile);

            var isApplied = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM __migrations WHERE ScriptName = @ScriptName",
                new { ScriptName = scriptName }) > 0;

            if (isApplied)
            {
                _logger.LogDebug("Migration {ScriptName} already applied, skipping", scriptName);
                continue;
            }

            _logger.LogInformation("Applying migration: {ScriptName}", scriptName);

            var scriptContent = await File.ReadAllTextAsync(scriptFile);

            using var transaction = connection.BeginTransaction();
            try
            {
                var statements = scriptContent.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var statement in statements)
                {
                    if (!string.IsNullOrWhiteSpace(statement))
                    {
                        await connection.ExecuteAsync(statement, transaction: transaction);
                    }
                }

                await connection.ExecuteAsync(
                    "INSERT INTO __migrations (ScriptName, AppliedAt) VALUES (@ScriptName, @AppliedAt)",
                    new { ScriptName = scriptName, AppliedAt = DateTime.UtcNow.ToString("O") },
                    transaction: transaction);

                transaction.Commit();
                _logger.LogInformation("Migration {ScriptName} applied successfully", scriptName);
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                _logger.LogError(ex, "Failed to apply migration {ScriptName}", scriptName);
                throw;
            }
        }
    }
}
