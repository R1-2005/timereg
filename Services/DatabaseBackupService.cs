using Microsoft.Data.Sqlite;
using timereg.Data;

namespace timereg.Services;

public class DatabaseBackupService
{
    private readonly string _dbPath;
    private readonly string _backupDir;
    private readonly string _connectionString;
    private readonly ILogger<DatabaseBackupService> _logger;

    public DatabaseBackupService(DbConnectionFactory connectionFactory, IConfiguration configuration, ILogger<DatabaseBackupService> logger)
    {
        _logger = logger;
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        // Extract DB path from connection string
        var builder = new SqliteConnectionStringBuilder(_connectionString);
        _dbPath = Path.GetFullPath(builder.DataSource);
        _backupDir = Path.Combine(Path.GetDirectoryName(_dbPath)!, "Backups");
    }

    public async Task<BackupStatus> GetStatusAsync()
    {
        var schemaVersion = await GetSchemaVersionAsync(_connectionString);
        DateTime? lastBackupAt = null;

        if (Directory.Exists(_backupDir))
        {
            var latest = Directory.GetFiles(_backupDir, "backup_*.db")
                .Select(f => new FileInfo(f))
                .OrderByDescending(f => f.CreationTimeUtc)
                .FirstOrDefault();

            if (latest != null)
                lastBackupAt = latest.CreationTimeUtc;
        }

        return new BackupStatus(lastBackupAt, schemaVersion);
    }

    public async Task<BackupInfo> CreateBackupAsync()
    {
        Directory.CreateDirectory(_backupDir);

        var timestamp = DateTime.Now.ToString("yyyy-MM-dd_HHmmss");
        var filename = $"backup_{timestamp}.db";
        var backupPath = Path.Combine(_backupDir, filename);

        // Use SQLite backup API
        using (var source = new SqliteConnection(_connectionString))
        using (var destination = new SqliteConnection($"Data Source={backupPath}"))
        {
            await source.OpenAsync();
            await destination.OpenAsync();
            source.BackupDatabase(destination);
        }

        // Write metadata into backup file
        var schemaVersion = await GetSchemaVersionAsync($"Data Source={backupPath}");
        using (var conn = new SqliteConnection($"Data Source={backupPath}"))
        {
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS __backup_info (BackupAt TEXT NOT NULL, SchemaVersion INTEGER NOT NULL);
                INSERT INTO __backup_info (BackupAt, SchemaVersion) VALUES (@backupAt, @version);
                """;
            cmd.Parameters.AddWithValue("@backupAt", DateTime.UtcNow.ToString("o"));
            cmd.Parameters.AddWithValue("@version", schemaVersion);
            await cmd.ExecuteNonQueryAsync();
        }

        var fileInfo = new FileInfo(backupPath);
        _logger.LogInformation("Backup opprettet: {Filename} ({Size} bytes, skjemaversjon {Version})",
            filename, fileInfo.Length, schemaVersion);

        return new BackupInfo(filename, fileInfo.CreationTimeUtc, schemaVersion, fileInfo.Length);
    }

    public async Task<List<BackupInfo>> GetBackupsAsync()
    {
        if (!Directory.Exists(_backupDir))
            return [];

        var backups = new List<BackupInfo>();

        foreach (var file in Directory.GetFiles(_backupDir, "backup_*.db").OrderByDescending(f => f))
        {
            var fi = new FileInfo(file);
            var version = await GetBackupSchemaVersionAsync(file);
            backups.Add(new BackupInfo(fi.Name, fi.CreationTimeUtc, version, fi.Length));
        }

        return backups;
    }

    public async Task RestoreAsync(string filename)
    {
        ValidateFilename(filename);
        var backupPath = Path.Combine(_backupDir, filename);

        if (!File.Exists(backupPath))
            throw new FileNotFoundException("Backup-filen finnes ikke.");

        // Compare schema versions
        var currentVersion = await GetSchemaVersionAsync(_connectionString);
        var backupVersion = await GetSchemaVersionAsync($"Data Source={backupPath}");

        if (currentVersion != backupVersion)
            throw new InvalidOperationException(
                $"Skjemaversjon stemmer ikke. Nåværende: {currentVersion}, backup: {backupVersion}. Kan ikke gjenopprette.");

        // Restore using SQLite backup API (backup → live DB)
        using var source = new SqliteConnection($"Data Source={backupPath}");
        using var destination = new SqliteConnection(_connectionString);
        await source.OpenAsync();
        await destination.OpenAsync();
        source.BackupDatabase(destination);

        _logger.LogInformation("Database gjenopprettet fra {Filename}", filename);
    }

    public void DeleteBackup(string filename)
    {
        ValidateFilename(filename);
        var backupPath = Path.Combine(_backupDir, filename);

        if (!File.Exists(backupPath))
            throw new FileNotFoundException("Backup-filen finnes ikke.");

        File.Delete(backupPath);
        _logger.LogInformation("Backup slettet: {Filename}", filename);
    }

    private static async Task<int> GetSchemaVersionAsync(string connectionString)
    {
        using var conn = new SqliteConnection(connectionString);
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM __migrations";
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    private static async Task<int> GetBackupSchemaVersionAsync(string filePath)
    {
        try
        {
            return await GetSchemaVersionAsync($"Data Source={filePath}");
        }
        catch
        {
            return -1;
        }
    }

    private static void ValidateFilename(string filename)
    {
        if (string.IsNullOrWhiteSpace(filename) ||
            filename.Contains("..") ||
            filename.Contains('/') ||
            filename.Contains('\\') ||
            !filename.StartsWith("backup_") ||
            !filename.EndsWith(".db"))
        {
            throw new ArgumentException("Ugyldig filnavn.");
        }
    }
}

public record BackupStatus(DateTime? LastBackupAt, int SchemaVersion);
public record BackupInfo(string Filename, DateTime CreatedAt, int SchemaVersion, long SizeBytes);
