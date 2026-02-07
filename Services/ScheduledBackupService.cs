namespace timereg.Services;

public class ScheduledBackupService : BackgroundService
{
    private readonly DatabaseBackupService _backupService;
    private readonly ILogger<ScheduledBackupService> _logger;

    public ScheduledBackupService(DatabaseBackupService backupService, ILogger<ScheduledBackupService> logger)
    {
        _backupService = backupService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;
            var nextRun = now.Date.AddDays(now.Hour >= 1 ? 1 : 0).AddHours(1);
            var delay = nextRun - now;

            _logger.LogInformation("Neste automatiske backup: {NextRun:yyyy-MM-dd HH:mm}", nextRun);
            await Task.Delay(delay, stoppingToken);

            try
            {
                var result = await _backupService.CreateBackupAsync();
                _logger.LogInformation("Automatisk backup fullført: {Filename}", result.Filename);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Automatisk backup feilet");
            }
        }
    }
}
