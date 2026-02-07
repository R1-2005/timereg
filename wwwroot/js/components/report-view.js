import api from '../services/api.js';
import MonthPicker from './month-picker.js';
import { formatDistribution, distributeWithRounding } from '../utils/formatting.js';

export default {
    name: 'ReportView',
    components: { MonthPicker },
    template: `
        <div class="report-view">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <MonthPicker
                    :year="year"
                    :month="month"
                    @update:year="year = $event"
                    @update:month="month = $event"
                />
                <span class="month-display">{{ employerName }}</span>
            </div>

            <div v-if="loading" class="loading">Laster...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="filteredReportData().length === 0" class="card">
                <p class="no-data">Ingen timer registrert for denne perioden.</p>
            </div>
            <div v-else>
                <div v-for="ip in invoiceProjects" :key="ip.id" class="card report-card">
                    <div class="report-header">
                        <h2>{{ ip.projectNumber }} {{ ip.name }}</h2>
                        <div class="report-actions">
                            <button class="btn btn-secondary" @click="downloadExcel(ip.id)">
                                📊 Last ned Excel
                            </button>
                            <button class="btn btn-success" @click="downloadPdf(ip.id)">
                                📄 Last ned PDF
                            </button>
                        </div>
                    </div>

                    <div v-if="getProjectData(ip.id).length === 0" class="no-data">
                        Ingen timer på dette prosjektet.
                    </div>
                    <table v-else>
                        <thead>
                            <tr>
                                <th>Konsulent</th>
                                <th>Jira-sak</th>
                                <th v-for="s in sections" :key="s.id" class="text-right">{{ s.shortName || s.name }}</th>
                                <th class="text-right">Timer totalt</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(consultant, cIndex) in getConsultantsForProject(ip.id)" :key="consultant.id">
                                <tr v-for="(entry, eIndex) in getEntriesForConsultant(ip.id, consultant.id)" :key="entry.jiraIssueKey">
                                    <td>{{ eIndex === 0 ? consultant.name : '' }}</td>
                                    <td>{{ entry.jiraIssueKey }}</td>
                                    <td v-for="s in sections" :key="s.id" class="text-right">{{ formatHours(getSectionHours(entry.hours, entry.jiraIssueKey, s.id)) }}</td>
                                    <td class="text-right">{{ formatHours(entry.hours) }}</td>
                                </tr>
                                <tr class="consultant-sum">
                                    <td colspan="2"><em>Sum {{ consultant.name }}</em></td>
                                    <td v-for="s in sections" :key="s.id" class="text-right"><em>{{ formatHours(getConsultantSectionTotal(ip.id, consultant.id, s.id)) }}</em></td>
                                    <td class="text-right"><em>{{ formatHours(getConsultantTotal(ip.id, consultant.id)) }}</em></td>
                                </tr>
                            </template>
                        </tbody>
                        <tfoot>
                            <tr class="sum-row">
                                <td colspan="2"><strong>Totalt</strong></td>
                                <td v-for="s in sections" :key="s.id" class="text-right"><strong>{{ formatHours(getProjectSectionTotal(ip.id, s.id)) }}</strong></td>
                                <td class="text-right"><strong>{{ formatHours(getProjectTotal(ip.id)) }}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `,
    data() {
        const saved = JSON.parse(localStorage.getItem('consultant') || '{}');
        return {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            reportData: [],
            invoiceProjects: [],
            sections: [],
            jiraProjects: [],
            loading: true,
            error: null,
            employerId: saved.employerId || null,
            employerName: saved.employerName || ''
        };
    },
    computed: {
        adjustedSectionHoursMap() {
            const map = {};
            for (const entry of this.filteredReportData()) {
                const cacheKey = `${entry.hours}-${entry.jiraIssueKey}`;
                if (map[cacheKey]) continue;

                const rawValues = {};
                const sdks = this.getSectionKeys(entry.jiraIssueKey);
                for (const s of this.sections) {
                    const sdk = sdks.find(sk => sk.sectionId === s.id);
                    rawValues[s.id] = sdk ? entry.hours * sdk.percentage / 100 : 0;
                }
                map[cacheKey] = distributeWithRounding(rawValues);
            }
            return map;
        }
    },
    watch: {
        year() { this.load(); },
        month() { this.load(); }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            this.loading = true;
            this.error = null;
            try {
                const [report, invoiceProjects, sections, jiraProjects] = await Promise.all([
                    api.getMonthlyReport(this.year, this.month),
                    api.getInvoiceProjects(),
                    api.getSections(),
                    api.getJiraProjects()
                ]);
                this.reportData = report;
                this.invoiceProjects = invoiceProjects;
                this.sections = sections;
                this.jiraProjects = jiraProjects;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            } finally {
                this.loading = false;
            }
        },
        formatHours(hours) {
            if (!hours || hours === 0) return '0,00';
            return formatDistribution(hours);
        },
        getSectionKeys(jiraIssueKey) {
            const dashIndex = jiraIssueKey.lastIndexOf('-');
            if (dashIndex <= 0) return [];
            const projectKey = jiraIssueKey.substring(0, dashIndex);
            const jp = this.jiraProjects.find(p => p.key === projectKey);
            return jp ? jp.sectionDistributionKeys : [];
        },
        getSectionHours(hours, jiraIssueKey, sectionId) {
            const cacheKey = `${hours}-${jiraIssueKey}`;
            const adjusted = this.adjustedSectionHoursMap[cacheKey];
            if (adjusted) return adjusted[sectionId] || 0;
            return 0;
        },
        getConsultantSectionTotal(invoiceProjectId, consultantId, sectionId) {
            return this.getEntriesForConsultant(invoiceProjectId, consultantId)
                .reduce((sum, e) => sum + this.getSectionHours(e.hours, e.jiraIssueKey, sectionId), 0);
        },
        getProjectSectionTotal(invoiceProjectId, sectionId) {
            return this.getProjectData(invoiceProjectId)
                .reduce((sum, e) => sum + this.getSectionHours(e.hours, e.jiraIssueKey, sectionId), 0);
        },
        filteredReportData() {
            if (!this.employerId) return this.reportData;
            return this.reportData.filter(r => r.employerId === this.employerId);
        },
        getProjectData(invoiceProjectId) {
            return this.filteredReportData().filter(r => r.invoiceProjectId === invoiceProjectId);
        },
        getConsultantsForProject(invoiceProjectId) {
            const data = this.getProjectData(invoiceProjectId);
            const consultantMap = new Map();
            for (const row of data) {
                if (!consultantMap.has(row.consultantId)) {
                    consultantMap.set(row.consultantId, {
                        id: row.consultantId,
                        name: `${row.firstName} ${row.lastName}`
                    });
                }
            }
            return Array.from(consultantMap.values());
        },
        getEntriesForConsultant(invoiceProjectId, consultantId) {
            return this.filteredReportData().filter(
                r => r.invoiceProjectId === invoiceProjectId && r.consultantId === consultantId
            );
        },
        getConsultantTotal(invoiceProjectId, consultantId) {
            return this.getEntriesForConsultant(invoiceProjectId, consultantId)
                .reduce((sum, e) => sum + e.hours, 0);
        },
        getProjectTotal(invoiceProjectId) {
            return this.getProjectData(invoiceProjectId)
                .reduce((sum, e) => sum + e.hours, 0);
        },
        downloadExcel(invoiceProjectId) {
            const url = api.getMonthlyReportExcelUrl(this.year, this.month, invoiceProjectId, this.employerId);
            window.location.href = url;
        },
        downloadPdf(invoiceProjectId) {
            const url = api.getMonthlyReportPdfUrl(this.year, this.month, invoiceProjectId, this.employerId);
            window.location.href = url;
        }
    }
};
