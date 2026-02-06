import api from '../services/api.js';
import MonthPicker from './month-picker.js';

export default {
    name: 'Home',
    components: { MonthPicker },
    template: `
        <div class="home">
            <MonthPicker
                :year="year"
                :month="month"
                @update:year="year = $event"
                @update:month="month = $event"
            />

            <div v-if="loading" class="loading">Laster...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="consultants.length === 0" class="card">
                <p style="color: #666;">Ingen konsulenter registrert.</p>
            </div>
            <div v-else class="card">
                <h2>Fakturering {{ monthName }} {{ year }}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Konsulent</th>
                            <th class="text-right">Utfylt</th>
                            <th class="text-right">Timer totalt</th>
                            <th v-for="ip in invoiceProjects" :key="ip.id" class="text-right">
                                {{ ip.projectNumber }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="consultant in consultants" :key="consultant.id">
                            <td>{{ consultant.firstName }} {{ consultant.lastName }}</td>
                            <td class="text-right">
                                <span :class="getCompletionClass(consultant.completionPercent)">
                                    {{ consultant.completionPercent }}%
                                </span>
                            </td>
                            <td class="text-right">{{ formatHours(consultant.totalHours) }}</td>
                            <td v-for="ip in invoiceProjects" :key="ip.id" class="text-right">
                                {{ formatHours(getDistributedHours(consultant.id, ip.id)) }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="sum-row">
                            <td><strong>Sum</strong></td>
                            <td></td>
                            <td class="text-right"><strong>{{ formatHours(totalHours) }}</strong></td>
                            <td v-for="ip in invoiceProjects" :key="ip.id" class="text-right">
                                <strong>{{ formatHours(getInvoiceProjectTotal(ip.id)) }}</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `,
    data() {
        return {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            summaryData: [],
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
        },
        workDaysInMonth() {
            const daysInMonth = new Date(this.year, this.month, 0).getDate();
            let workDays = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(this.year, this.month - 1, day);
                const dow = date.getDay();
                if (dow !== 0 && dow !== 6) {
                    workDays++;
                }
            }
            return workDays;
        },
        consultants() {
            const map = new Map();
            for (const row of this.summaryData) {
                if (!map.has(row.consultantId)) {
                    const completionPercent = this.workDaysInMonth > 0
                        ? Math.round((row.daysWithEntries / this.workDaysInMonth) * 100)
                        : 0;
                    map.set(row.consultantId, {
                        id: row.consultantId,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        totalHours: row.totalHours,
                        daysWithEntries: row.daysWithEntries,
                        completionPercent: completionPercent,
                        distributions: {}
                    });
                }
                map.get(row.consultantId).distributions[row.invoiceProjectId] = row.distributedHours;
            }
            return Array.from(map.values());
        },
        totalHours() {
            return this.consultants.reduce((sum, c) => sum + c.totalHours, 0);
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
                const [summary, invoiceProjects] = await Promise.all([
                    api.getMonthlySummary(this.year, this.month),
                    api.getInvoiceProjects()
                ]);
                this.summaryData = summary;
                this.invoiceProjects = invoiceProjects;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            } finally {
                this.loading = false;
            }
        },
        formatHours(hours) {
            if (!hours || hours === 0) return '-';
            return hours.toFixed(2).replace('.', ',');
        },
        getDistributedHours(consultantId, invoiceProjectId) {
            const consultant = this.consultants.find(c => c.id === consultantId);
            if (!consultant) return 0;
            return consultant.distributions[invoiceProjectId] || 0;
        },
        getInvoiceProjectTotal(invoiceProjectId) {
            return this.consultants.reduce((sum, c) => {
                return sum + (c.distributions[invoiceProjectId] || 0);
            }, 0);
        },
        getCompletionClass(percent) {
            if (percent < 50) return 'completion-low';
            if (percent < 80) return 'completion-medium';
            return 'completion-high';
        }
    }
};
