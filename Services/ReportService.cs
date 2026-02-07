using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using timereg.Helpers;
using timereg.Models;
using static timereg.Repositories.ReportRepository;

namespace timereg.Services;

public class ReportService
{
    private static Dictionary<int, double> GetAdjustedSectionHours(
        string jiraIssueKey,
        double hours,
        List<Section> sections,
        Dictionary<string, Dictionary<int, double>> sectionKeyLookup)
    {
        var projectKey = JiraIssueKeyParser.ExtractProjectKey(jiraIssueKey);
        var rawValues = new Dictionary<int, double>();

        foreach (var s in sections)
        {
            double sectionHours = 0;
            if (projectKey != null && sectionKeyLookup.TryGetValue(projectKey, out var sectionPcts) && sectionPcts.TryGetValue(s.Id, out var pct))
                sectionHours = hours * pct / 100.0;
            rawValues[s.Id] = sectionHours;
        }

        return RoundingHelper.DistributeWithRounding(rawValues);
    }

    public byte[] GenerateExcel(
        InvoiceProject invoiceProject,
        List<MonthlyReportRow> projectData,
        List<Section> sections,
        List<JiraProjectDto> jiraProjectDtos,
        int year,
        int month)
    {
        var sectionKeyLookup = jiraProjectDtos.ToDictionary(
            jp => jp.Key,
            jp => jp.SectionDistributionKeys.ToDictionary(sdk => sdk.SectionId, sdk => (double)sdk.Percentage));

        var timerCol = 3 + sections.Count;

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Fakturering");

        // Header
        worksheet.Cell(1, 1).Value = $"{invoiceProject.ProjectNumber} {invoiceProject.Name}";
        worksheet.Cell(1, 1).Style.Font.Bold = true;
        worksheet.Cell(1, 1).Style.Font.FontSize = 14;
        worksheet.Cell(2, 1).Value = $"{MonthNames.Norwegian[month]} {year}";

        // Column headers
        worksheet.Cell(4, 1).Value = "Konsulent";
        worksheet.Cell(4, 2).Value = "Jira-sak";
        for (int i = 0; i < sections.Count; i++)
            worksheet.Cell(4, 3 + i).Value = sections[i].ShortName ?? sections[i].Name;
        worksheet.Cell(4, timerCol).Value = "Timer totalt";
        worksheet.Range(4, 1, 4, timerCol).Style.Font.Bold = true;
        worksheet.Range(4, 1, 4, timerCol).Style.Border.BottomBorder = XLBorderStyleValues.Thin;

        var row = 5;
        var currentConsultant = "";
        var consultantTotal = 0.0;
        var grandTotal = 0.0;
        var consultantSectionTotals = sections.ToDictionary(s => s.Id, _ => 0.0);
        var grandSectionTotals = sections.ToDictionary(s => s.Id, _ => 0.0);

        foreach (var entry in projectData)
        {
            var consultantName = $"{entry.FirstName} {entry.LastName}";

            if (currentConsultant != "" && currentConsultant != consultantName)
            {
                WriteExcelConsultantSum(worksheet, row, currentConsultant, consultantTotal, sections, consultantSectionTotals, timerCol);
                row += 2;
                consultantTotal = 0;
                foreach (var s in sections) consultantSectionTotals[s.Id] = 0;
            }

            currentConsultant = consultantName;
            worksheet.Cell(row, 1).Value = consultantName;
            worksheet.Cell(row, 2).Value = entry.JiraIssueKey;
            var adjustedSection = GetAdjustedSectionHours(entry.JiraIssueKey, entry.Hours, sections, sectionKeyLookup);
            for (int i = 0; i < sections.Count; i++)
            {
                var sectionHours = adjustedSection.GetValueOrDefault(sections[i].Id);
                worksheet.Cell(row, 3 + i).Value = sectionHours;
                worksheet.Cell(row, 3 + i).Style.NumberFormat.Format = "0.00";
                consultantSectionTotals[sections[i].Id] += sectionHours;
                grandSectionTotals[sections[i].Id] += sectionHours;
            }
            worksheet.Cell(row, timerCol).Value = entry.Hours;
            worksheet.Cell(row, timerCol).Style.NumberFormat.Format = "0.00";

            consultantTotal += entry.Hours;
            grandTotal += entry.Hours;
            row++;
        }

        // Last consultant sum
        if (currentConsultant != "")
        {
            WriteExcelConsultantSum(worksheet, row, currentConsultant, consultantTotal, sections, consultantSectionTotals, timerCol);
            row++;
        }

        // Grand total
        row++;
        worksheet.Cell(row, 1).Value = "TOTALT";
        worksheet.Cell(row, 1).Style.Font.Bold = true;
        for (int i = 0; i < sections.Count; i++)
        {
            worksheet.Cell(row, 3 + i).Value = grandSectionTotals[sections[i].Id];
            worksheet.Cell(row, 3 + i).Style.Font.Bold = true;
            worksheet.Cell(row, 3 + i).Style.NumberFormat.Format = "0.00";
        }
        worksheet.Cell(row, timerCol).Value = grandTotal;
        worksheet.Cell(row, timerCol).Style.Font.Bold = true;
        worksheet.Cell(row, timerCol).Style.NumberFormat.Format = "0.00";

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void WriteExcelConsultantSum(
        IXLWorksheet worksheet, int row, string consultantName, double total,
        List<Section> sections, Dictionary<int, double> sectionTotals, int timerCol)
    {
        worksheet.Cell(row, 1).Value = $"Sum {consultantName}";
        worksheet.Cell(row, 1).Style.Font.Italic = true;
        for (int i = 0; i < sections.Count; i++)
        {
            worksheet.Cell(row, 3 + i).Value = sectionTotals[sections[i].Id];
            worksheet.Cell(row, 3 + i).Style.Font.Italic = true;
            worksheet.Cell(row, 3 + i).Style.NumberFormat.Format = "0.00";
        }
        worksheet.Cell(row, timerCol).Value = total;
        worksheet.Cell(row, timerCol).Style.Font.Italic = true;
        worksheet.Cell(row, timerCol).Style.NumberFormat.Format = "0.00";
    }

    public byte[] GenerateTimesheetExcel(
        string consultantName,
        IEnumerable<TimeEntry> entries,
        List<InvoiceProject> invoiceProjects,
        List<JiraProjectDto> jiraProjectDtos,
        int year,
        int month)
    {
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var entriesList = entries.ToList();

        // Group entries by issue key
        var issueKeys = entriesList.Select(e => e.JiraIssueKey).Distinct().OrderBy(k => k).ToList();
        var entryLookup = entriesList.ToDictionary(e => $"{e.JiraIssueKey}-{e.Date.Day}");

        // Build distribution key lookup: project key -> invoiceProjectId -> percentage
        var distKeyLookup = jiraProjectDtos.ToDictionary(
            jp => jp.Key,
            jp => jp.DistributionKeys.ToDictionary(dk => dk.InvoiceProjectId, dk => (double)dk.Percentage));

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Timeark");

        // Header
        ws.Cell(1, 1).Value = consultantName;
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = $"{MonthNames.Norwegian[month]} {year}";

        // Column headers
        ws.Cell(4, 1).Value = "Jira-sak";
        for (int d = 1; d <= daysInMonth; d++)
        {
            var date = new DateOnly(year, month, d);
            ws.Cell(4, 1 + d).Value = d;
            ws.Cell(4, 1 + d).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            // Mark weekends
            if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                ws.Cell(4, 1 + d).Style.Font.FontColor = XLColor.Gray;
        }
        ws.Cell(4, daysInMonth + 2).Value = "Sum";
        var headerRange = ws.Range(4, 1, 4, daysInMonth + 2);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Border.BottomBorder = XLBorderStyleValues.Thin;

        // Data rows
        var row = 5;
        var dayTotals = new double[daysInMonth + 1]; // 1-indexed

        foreach (var issueKey in issueKeys)
        {
            ws.Cell(row, 1).Value = issueKey;
            var rowTotal = 0.0;

            for (int d = 1; d <= daysInMonth; d++)
            {
                if (entryLookup.TryGetValue($"{issueKey}-{d}", out var entry) && entry.Hours > 0)
                {
                    ws.Cell(row, 1 + d).Value = (double)entry.Hours;
                    ws.Cell(row, 1 + d).Style.NumberFormat.Format = "0.00";
                    rowTotal += (double)entry.Hours;
                    dayTotals[d] += (double)entry.Hours;
                }
            }

            ws.Cell(row, daysInMonth + 2).Value = rowTotal;
            ws.Cell(row, daysInMonth + 2).Style.NumberFormat.Format = "0.00";
            ws.Cell(row, daysInMonth + 2).Style.Font.Bold = true;
            row++;
        }

        // Sum row
        ws.Cell(row, 1).Value = "Sum";
        ws.Cell(row, 1).Style.Font.Bold = true;
        var grandTotal = 0.0;
        for (int d = 1; d <= daysInMonth; d++)
        {
            if (dayTotals[d] > 0)
            {
                ws.Cell(row, 1 + d).Value = dayTotals[d];
                ws.Cell(row, 1 + d).Style.NumberFormat.Format = "0.00";
            }
            ws.Cell(row, 1 + d).Style.Font.Bold = true;
            grandTotal += dayTotals[d];
        }
        ws.Cell(row, daysInMonth + 2).Value = grandTotal;
        ws.Cell(row, daysInMonth + 2).Style.NumberFormat.Format = "0.00";
        ws.Cell(row, daysInMonth + 2).Style.Font.Bold = true;
        ws.Range(row, 1, row, daysInMonth + 2).Style.Border.TopBorder = XLBorderStyleValues.Thin;

        // Invoice project distribution rows — compute adjusted distributions per day
        var adjustedDayDist = new Dictionary<int, Dictionary<int, double>>();
        for (int d = 1; d <= daysInMonth; d++)
        {
            var rawValues = new Dictionary<int, double>();
            foreach (var ip in invoiceProjects)
            {
                var daySum = 0.0;
                foreach (var e in entriesList.Where(e => e.Date.Day == d))
                {
                    var projectKey = JiraIssueKeyParser.ExtractProjectKey(e.JiraIssueKey);
                    if (projectKey != null && distKeyLookup.TryGetValue(projectKey, out var ipPcts) && ipPcts.TryGetValue(ip.Id, out var pct))
                        daySum += (double)e.Hours * pct / 100.0;
                }
                rawValues[ip.Id] = daySum;
            }
            adjustedDayDist[d] = RoundingHelper.DistributeWithRounding(rawValues);
        }

        foreach (var ip in invoiceProjects)
        {
            row++;
            var label = ip.ShortName ?? $"{ip.ProjectNumber} {ip.Name}";
            ws.Cell(row, 1).Value = label;
            ws.Cell(row, 1).Style.Font.Italic = true;
            var ipTotal = 0.0;

            for (int d = 1; d <= daysInMonth; d++)
            {
                var daySum = adjustedDayDist[d].GetValueOrDefault(ip.Id);
                if (daySum > 0)
                {
                    ws.Cell(row, 1 + d).Value = daySum;
                    ws.Cell(row, 1 + d).Style.NumberFormat.Format = "0.00";
                }
                ws.Cell(row, 1 + d).Style.Font.Italic = true;
                ipTotal += daySum;
            }

            ws.Cell(row, daysInMonth + 2).Value = ipTotal;
            ws.Cell(row, daysInMonth + 2).Style.NumberFormat.Format = "0.00";
            ws.Cell(row, daysInMonth + 2).Style.Font.Italic = true;
        }

        ws.Column(1).AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] GeneratePdf(
        InvoiceProject invoiceProject,
        string employerName,
        List<MonthlyReportRow> projectData,
        List<Section> sections,
        List<JiraProjectDto> jiraProjectDtos,
        int year,
        int month)
    {
        var sectionKeyLookup = jiraProjectDtos.ToDictionary(
            jp => jp.Key,
            jp => jp.SectionDistributionKeys.ToDictionary(sdk => sdk.SectionId, sdk => (double)sdk.Percentage));

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Row(headerRow =>
                    {
                        headerRow.RelativeItem().Text($"{invoiceProject.ProjectNumber} {invoiceProject.Name}")
                            .FontSize(16).Bold();
                        if (!string.IsNullOrEmpty(employerName))
                            headerRow.RelativeItem().AlignRight().Text(employerName)
                                .FontSize(16).Bold();
                    });
                    col.Item().Text($"{MonthNames.Norwegian[month]} {year}")
                        .FontSize(12);
                    col.Item().PaddingBottom(20);
                });

                page.Content().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(2.1f); // Konsulent
                        columns.RelativeColumn(1.8f); // Jira-sak
                        foreach (var _ in sections)
                            columns.RelativeColumn(1.5f); // Section columns
                        columns.RelativeColumn(1); // Timer
                    });

                    // Header
                    table.Header(header =>
                    {
                        header.Cell().BorderBottom(1).Padding(5).Text("Konsulent").Bold();
                        header.Cell().BorderBottom(1).Padding(5).Text("Jira-sak").Bold();
                        foreach (var s in sections)
                            header.Cell().BorderBottom(1).Padding(5).AlignRight().Text(s.ShortName ?? s.Name).Bold();
                        header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Timer totalt").Bold();
                    });

                    var currentConsultant = "";
                    var consultantTotal = 0.0;
                    var grandTotal = 0.0;
                    var consultantSectionTotals = sections.ToDictionary(s => s.Id, _ => 0.0);
                    var grandSectionTotals = sections.ToDictionary(s => s.Id, _ => 0.0);

                    foreach (var entry in projectData)
                    {
                        var consultantName = $"{entry.FirstName} {entry.LastName}";

                        if (currentConsultant != "" && currentConsultant != consultantName)
                        {
                            // Sum row for previous consultant
                            table.Cell().Padding(5).Text($"Sum {currentConsultant}").Italic();
                            table.Cell().Padding(5).Text("");
                            foreach (var s in sections)
                                table.Cell().Padding(5).AlignRight().Text(consultantSectionTotals[s.Id].ToString("0.00")).Italic();
                            table.Cell().Padding(5).AlignRight().Text(consultantTotal.ToString("0.00")).Italic();

                            // Empty row
                            table.Cell().Padding(5).Text("");
                            table.Cell().Padding(5).Text("");
                            foreach (var _ in sections)
                                table.Cell().Padding(5).Text("");
                            table.Cell().Padding(5).Text("");

                            consultantTotal = 0;
                            foreach (var s in sections) consultantSectionTotals[s.Id] = 0;
                        }

                        currentConsultant = consultantName;
                        table.Cell().Padding(5).Text(consultantName);
                        table.Cell().Padding(5).Text(entry.JiraIssueKey);
                        var adjustedSection = GetAdjustedSectionHours(entry.JiraIssueKey, entry.Hours, sections, sectionKeyLookup);
                        foreach (var s in sections)
                        {
                            var sectionHours = adjustedSection.GetValueOrDefault(s.Id);
                            table.Cell().Padding(5).AlignRight().Text(sectionHours.ToString("0.00"));
                            consultantSectionTotals[s.Id] += sectionHours;
                            grandSectionTotals[s.Id] += sectionHours;
                        }
                        table.Cell().Padding(5).AlignRight().Text(entry.Hours.ToString("0.00"));

                        consultantTotal += entry.Hours;
                        grandTotal += entry.Hours;
                    }

                    // Last consultant sum
                    if (currentConsultant != "")
                    {
                        table.Cell().Padding(5).Text($"Sum {currentConsultant}").Italic();
                        table.Cell().Padding(5).Text("");
                        foreach (var s in sections)
                            table.Cell().Padding(5).AlignRight().Text(consultantSectionTotals[s.Id].ToString("0.00")).Italic();
                        table.Cell().Padding(5).AlignRight().Text(consultantTotal.ToString("0.00")).Italic();
                    }

                    // Empty row before grand total
                    table.Cell().Padding(5).Text("");
                    table.Cell().Padding(5).Text("");
                    foreach (var _ in sections)
                        table.Cell().Padding(5).Text("");
                    table.Cell().Padding(5).Text("");

                    // Grand total
                    table.Cell().BorderTop(1).Padding(5).Text("TOTALT").Bold();
                    table.Cell().BorderTop(1).Padding(5).Text("");
                    foreach (var s in sections)
                        table.Cell().BorderTop(1).Padding(5).AlignRight().Text(grandSectionTotals[s.Id].ToString("0.00")).Bold();
                    table.Cell().BorderTop(1).Padding(5).AlignRight().Text(grandTotal.ToString("0.00")).Bold();
                });
            });
        });

        return document.GeneratePdf();
    }
}
