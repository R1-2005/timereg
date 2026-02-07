using System.Collections.Concurrent;
using System.Text.Json;
using timereg.Models;

namespace timereg.Services;

public class HolidayService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HolidayService> _logger;
    private readonly ConcurrentDictionary<int, List<HolidayDto>> _cache = new();

    public HolidayService(IHttpClientFactory httpClientFactory, ILogger<HolidayService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task PreloadAsync()
    {
        var now = DateTime.Now;
        var currentYear = now.Year;
        var otherYear = now.Month <= 6 ? currentYear - 1 : currentYear + 1;
        var years = new[] { currentYear, otherYear };

        foreach (var year in years)
        {
            var holidays = await GetHolidaysAsync(year);
            if (holidays.Count > 0)
                _logger.LogInformation("Helligdager {Year}: lastet {Count} dager", year, holidays.Count);
            else
                _logger.LogInformation("Helligdager {Year}: ingen data (API utilgjengelig?)", year);
        }
    }

    public async Task<List<HolidayDto>> GetHolidaysAsync(int year)
    {
        if (_cache.TryGetValue(year, out var cached))
            return cached;

        try
        {
            var client = _httpClientFactory.CreateClient("NagerDate");
            var response = await client.GetAsync($"PublicHolidays/{year}/NO");
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var holidays = JsonSerializer.Deserialize<List<NagerHoliday>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            var result = holidays?
                .Select(h => new HolidayDto(h.Date, h.LocalName))
                .ToList() ?? [];

            _cache[year] = result;
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Kunne ikke hente helligdager for {Year}", year);
            return [];
        }
    }

    private class NagerHoliday
    {
        public string Date { get; set; } = "";
        public string LocalName { get; set; } = "";
    }
}
