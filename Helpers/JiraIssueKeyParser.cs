namespace timereg.Helpers;

public static class JiraIssueKeyParser
{
    public static string? ExtractProjectKey(string issueKey)
    {
        var dashIndex = issueKey.LastIndexOf('-');
        if (dashIndex <= 0)
            return null;
        return issueKey[..dashIndex];
    }
}
