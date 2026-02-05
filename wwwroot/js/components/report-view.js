import api from '../services/api.js';

export default {
    name: 'ReportView',
    template: `
        <div class="report-view">
            <div class="month-picker">
                <button class="month-btn" @click="prevMonth">&larr;</button>
                <span class="month-display">{{ monthName }} {{ year }}</span>
                <button class="month-btn" @click="nextMonth">&rarr;</button>
            </div>

            <div v-if="loading" class="loading">Laster...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="reportData.length === 0" class="card">
                <p style="color: #666;">Ingen timer registrert for denne perioden.</p>
            </div>
            <div v-else>
                <div v-for="ip in invoiceProjects" :key="ip.id" class="card report-card">
                    <div class="report-header">
                        <h2>{{ ip.projectNumber }} {{ ip.name }}</h2>
                        <button class="btn btn-primary" @click="downloadExcel(ip.id)">
                            Last ned Excel
                        </button>
                    </div>

                    <div v-if="getProjectData(ip.id).length === 0" class="no-data">
                        Ingen timer på dette prosjektet.
                    </div>
                    <table v-else>
                        <thead>
                            <tr>
                                <th>Konsulent</th>
                                <th>Jira-sak</th>
                                <th class="text-right">Timer</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(consultant, cIndex) in getConsultantsForProject(ip.id)" :key="consultant.id">
                                <tr v-for="(entry, eIndex) in getEntriesForConsultant(ip.id, consultant.id)" :key="entry.jiraIssueKey">
                                    <td>{{ eIndex === 0 ? consultant.name : '' }}</td>
                                    <td>{{ entry.jiraIssueKey }}</td>
                                    <td class="text-right">{{ formatHours(entry.hours) }}</td>
                                </tr>
                                <tr class="consultant-sum">
                                    <td colspan="2"><em>Sum {{ consultant.name }}</em></td>
                                    <td class="text-right"><em>{{ formatHours(getConsultantTotal(ip.id, consultant.id)) }}</em></td>
                                </tr>
                            </template>
                        </tbody>
                        <tfoot>
                            <tr class="sum-row">
                                <td colspan="2"><strong>Totalt</strong></td>
                                <td class="text-right"><strong>{{ formatHours(getProjectTotal(ip.id)) }}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            reportData: [],
            invoiceProjects: [],
            loading: true,
            error: null
        };
    },
    computed: {
        monthName() {
            const names = ['', 'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
                'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
            return names[this.month];
        }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            this.loading = true;
            this.error = null;
            try {
                const [report, invoiceProjects] = await Promise.all([
                    api.getMonthlyReport(this.year, this.month),
                    api.getInvoiceProjects()
                ]);
                this.reportData = report;
                this.invoiceProjects = invoiceProjects;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            } finally {
                this.loading = false;
            }
        },
        prevMonth() {
            if (this.month === 1) {
                this.month = 12;
                this.year--;
            } else {
                this.month--;
            }
            this.load();
        },
        nextMonth() {
            if (this.month === 12) {
                this.month = 1;
                this.year++;
            } else {
                this.month++;
            }
            this.load();
        },
        formatHours(hours) {
            if (!hours || hours === 0) return '0,00';
            return hours.toFixed(2).replace('.', ',');
        },
        getProjectData(invoiceProjectId) {
            return this.reportData.filter(r => r.invoiceProjectId === invoiceProjectId);
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
            return this.reportData.filter(
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
            const url = api.getMonthlyReportExcelUrl(this.year, this.month, invoiceProjectId);
            window.location.href = url;
        }
    }
};
