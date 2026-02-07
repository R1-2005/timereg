namespace timereg.Helpers;

public static class RoundingHelper
{
    /// <summary>
    /// Adjusts distributed values using the largest remainder method so that
    /// the sum of 2-decimal-rounded values equals the rounded total.
    /// Prevents rounding errors when distributing hours across projects/sections.
    /// </summary>
    public static Dictionary<TKey, double> DistributeWithRounding<TKey>(Dictionary<TKey, double> rawValues) where TKey : notnull
    {
        if (rawValues.Count == 0)
            return new Dictionary<TKey, double>();

        var totalRaw = rawValues.Values.Sum();
        var totalTarget = (int)Math.Round(totalRaw * 100);

        var items = rawValues
            .Select(kv =>
            {
                var cents = kv.Value * 100;
                var floored = (int)Math.Floor(cents);
                return new { kv.Key, Floored = floored, Remainder = cents - floored };
            })
            .OrderByDescending(x => x.Remainder)
            .ToList();

        var flooredSum = items.Sum(x => x.Floored);
        var extra = totalTarget - flooredSum;

        var result = new Dictionary<TKey, double>();
        foreach (var item in items)
        {
            result[item.Key] = (item.Floored + (extra > 0 ? 1 : 0)) / 100.0;
            if (extra > 0) extra--;
        }

        return result;
    }
}
