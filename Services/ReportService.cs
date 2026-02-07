using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using timereg.Helpers;
using timereg.Models;
using static timereg.Repositories.ReportRepository;

namespace timereg.Services;

public class ReportService
{
    private static double GetSectionHours(
        string jiraIssueKey,
        int sectionId,
        double hours,
        Dictionary<string, Dictionary<int, double>> sectionKeyLookup)
    {
        var projectKey = JiraIssueKeyParser.ExtractProjectKey(jiraIssueKey);
        if (projectKey is null) return 0;
        if (sectionKeyLookup.TryGetValue(projectKey, out var sectionPcts) && sectionPcts.TryGetValue(sectionId, out var pct))
            return hours * pct / 100.0;
        return 0;
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
            for (int i = 0; i < sections.Count; i++)
            {
                var sectionHours = GetSectionHours(entry.JiraIssueKey, sections[i].Id, entry.Hours, sectionKeyLookup);
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
                        columns.RelativeColumn(3); // Konsulent
                        columns.RelativeColumn(2); // Jira-sak
                        foreach (var _ in sections)
                            columns.RelativeColumn(1); // Section columns
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
                        foreach (var s in sections)
                        {
                            var sectionHours = GetSectionHours(entry.JiraIssueKey, s.Id, entry.Hours, sectionKeyLookup);
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
