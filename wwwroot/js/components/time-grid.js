import api from '../services/api.js';
import { formatHours as fmtHours, formatDistribution as fmtDist, distributeWithRounding } from '../utils/formatting.js';
import { fetchHolidaysForMonth } from '../utils/holidays.js';

export default {
    name: 'TimeGrid',
    template: `
        <div class="time-grid-container">
            <div v-if="error" class="error">{{ error }}</div>
            <div v-if="saving" class="saving-indicator">Lagrer...</div>

            <div class="time-grid-wrapper">
                <table class="time-grid">
                    <thead>
                        <tr class="weekday-row">
                            <th class="issue-col"></th>
                            <th v-for="day in daysInMonth" :key="'wd-' + day" class="day-col" :class="{ weekend: isWeekend(day), holiday: isHoliday(day) && !isWeekend(day), 'weekend-text': isWeekend(day) || isHoliday(day) }" :title="getHolidayName(day)">
                                {{ getWeekdayShort(day) }}
                            </th>
                            <th class="sum-col"></th>
                            <th class="action-col"></th>
                        </tr>
                        <tr>
                            <th class="issue-col">Jira-sak</th>
                            <th v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day), holiday: isHoliday(day) && !isWeekend(day), 'weekend-text': isHoliday(day) }" :title="getHolidayName(day)">
                                {{ day }}
                            </th>
                            <th class="sum-col">Sum</th>
                            <th class="action-col"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Time entry rows -->
                        <tr v-for="(row, rowIndex) in rows" :key="row.issueKey || 'new-' + rowIndex">
                            <td class="issue-col">
                                <input
                                    v-if="rowIndex === rows.length - 1 && !locked"
                                    v-model="newIssueKey"
                                    @blur="addNewRow"
                                    @keydown.enter="addNewRow"
                                    placeholder="Ny sak..."
                                    class="issue-input"
                                >
                                <span v-else-if="rowIndex < rows.length - 1" class="issue-key">{{ row.issueKey }}</span>
                            </td>
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day), holiday: isHoliday(day) && !isWeekend(day) }">
                                <input
                                    v-if="rowIndex < rows.length - 1"
                                    :value="getDisplayValue(row.issueKey, day)"
                                    @focus="onFocus($event, row.issueKey, day)"
                                    @blur="onBlur($event, row.issueKey, day)"
                                    @keydown.enter="$event.target.blur()"
                                    class="hours-input"
                                    :disabled="locked"
                                >
                            </td>
                            <td class="sum-col">
                                <span v-if="rowIndex < rows.length - 1">{{ formatHours(getRowSum(row.issueKey)) }}</span>
                            </td>
                            <td class="action-col">
                                <button
                                    v-if="rowIndex < rows.length - 1 && !locked"
                                    class="btn-delete"
                                    @click="deleteRow(row.issueKey)"
                                    title="Slett rad"
                                >&times;</button>
                            </td>
                        </tr>

                        <!-- Sum row -->
                        <tr class="sum-row">
                            <td class="issue-col"><strong>Sum timer</strong></td>
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day), holiday: isHoliday(day) && !isWeekend(day) }">
                                <strong>{{ formatHours(getDaySum(day)) }}</strong>
                            </td>
                            <td class="sum-col"><strong>{{ formatHours(getTotalSum()) }}</strong></td>
                            <td class="action-col"></td>
                        </tr>

                        <!-- Invoice project distribution rows -->
                        <tr v-for="ip in invoiceProjects" :key="ip.id" class="distribution-row">
                            <td class="issue-col">
                                <span class="invoice-project">{{ ip.shortName || (ip.projectNumber + ' ' + ip.name) }}</span>
                            </td>
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day), holiday: isHoliday(day) && !isWeekend(day) }">
                                {{ formatDistribution(adjustedDayDistributions[day][ip.id] || 0) }}
                            </td>
                            <td class="sum-col">{{ formatDistribution(adjustedTotalDistributions[ip.id] || 0) }}</td>
                            <td class="action-col"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    props: {
        consultantId: {
            type: Number,
            required: true
        },
        year: {
            type: Number,
            required: true
        },
        month: {
            type: Number,
            required: true
        },
        displayMode: {
            type: String,
            default: 'decimal'
        },
        locked: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            entries: [],
            jiraProjects: [],
            invoiceProjects: [],
            holidays: [],
            newIssueKey: '',
            error: null,
            saving: false
        };
    },
    computed: {
        daysInMonth() {
            const days = new Date(this.year, this.month, 0).getDate();
            return Array.from({ length: days }, (_, i) => i + 1);
        },
        rows() {
            const issueKeys = [...new Set(this.entries.map(e => e.jiraIssueKey))];
            const rows = issueKeys.map(issueKey => ({ issueKey }));
            rows.push({ issueKey: null }); // New row
            return rows;
        },
        entriesByIssueAndDay() {
            const map = {};
            for (const entry of this.entries) {
                const key = `${entry.jiraIssueKey}-${new Date(entry.date).getDate()}`;
                map[key] = entry;
            }
            return map;
        },
        adjustedDayDistributions() {
            const result = {};
            for (const day of this.daysInMonth) {
                const rawValues = {};
                for (const ip of this.invoiceProjects) {
                    rawValues[ip.id] = this.getInvoiceProjectDaySum(ip.id, day);
                }
                result[day] = distributeWithRounding(rawValues);
            }
            return result;
        },
        adjustedTotalDistributions() {
            const rawValues = {};
            for (const ip of this.invoiceProjects) {
                rawValues[ip.id] = this.getInvoiceProjectTotalSum(ip.id);
            }
            return distributeWithRounding(rawValues);
        },
        holidayMap() {
            const map = new Map();
            const y = this.year;
            const m = this.month;
            for (const h of this.holidays) {
                const d = new Date(h.date);
                if (d.getFullYear() === y && d.getMonth() + 1 === m) {
                    map.set(d.getDate(), h.name);
                }
            }
            return map;
        }
    },
    watch: {
        year() { this.load(); },
        month() { this.load(); },
        consultantId() { this.load(); }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            this.error = null;
            try {
                const [entries, jiraProjects, invoiceProjects, holidays] = await Promise.all([
                    api.getTimeEntries(this.consultantId, this.year, this.month),
                    api.getJiraProjects(),
                    api.getInvoiceProjects(),
                    fetchHolidaysForMonth(this.year, this.month)
                ]);
                this.entries = entries;
                this.jiraProjects = jiraProjects;
                this.invoiceProjects = invoiceProjects;
                this.holidays = holidays;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            }
        },

        isWeekend(day) {
            const date = new Date(this.year, this.month - 1, day);
            const dow = date.getDay();
            return dow === 0 || dow === 6;
        },

        isHoliday(day) {
            return this.holidayMap.has(day);
        },

        getHolidayName(day) {
            return this.holidayMap.get(day) || '';
        },

        getWeekdayShort(day) {
            const date = new Date(this.year, this.month - 1, day);
            const weekdays = ['Sø', 'Ma', 'Ti', 'On', 'To', 'Fr', 'Lø'];
            return weekdays[date.getDay()];
        },

        getEntry(issueKey, day) {
            return this.entriesByIssueAndDay[`${issueKey}-${day}`];
        },

        getDisplayValue(issueKey, day) {
            const entry = this.getEntry(issueKey, day);
            if (!entry || entry.hours === 0) return '';
            return this.formatHours(entry.hours);
        },

        formatHours(hours) {
            return fmtHours(hours, this.displayMode);
        },

        formatDistribution(hours) {
            return fmtDist(hours, this.displayMode);
        },

        parseHours(value) {
            if (!value || value.trim() === '') return 0;
            value = value.trim();

            // h:mm format
            const timeMatch = value.match(/^(\d+):(\d{1,2})$/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                return hours + minutes / 60;
            }

            // Decimal with comma or dot
            const decimal = parseFloat(value.replace(',', '.'));
            if (!isNaN(decimal)) {
                return Math.min(24, Math.max(0, decimal));
            }

            return 0;
        },

        onFocus(event, issueKey, day) {
            event.target.select();
        },

        async onBlur(event, issueKey, day) {
            const hours = this.parseHours(event.target.value);
            const entry = this.getEntry(issueKey, day);
            const currentHours = entry ? entry.hours : 0;

            if (hours === currentHours) {
                event.target.value = this.getDisplayValue(issueKey, day);
                return;
            }

            if (hours === 0 && entry) {
                await this.deleteEntry(entry.id);
            } else if (hours > 0) {
                await this.saveEntry(issueKey, day, hours);
            }

            event.target.value = this.getDisplayValue(issueKey, day);
        },

        async saveEntry(issueKey, day, hours) {
            this.saving = true;
            this.error = null;
            try {
                const dateStr = `${this.year}-${String(this.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const result = await api.upsertTimeEntry({
                    consultantId: this.consultantId,
                    jiraIssueKey: issueKey,
                    date: dateStr,
                    hours: hours
                });

                // Update local state
                const existingIndex = this.entries.findIndex(
                    e => e.jiraIssueKey === issueKey && new Date(e.date).getDate() === day
                );
                if (existingIndex >= 0) {
                    this.entries[existingIndex] = result;
                } else {
                    this.entries.push(result);
                }
            } catch (e) {
                this.error = 'Kunne ikke lagre: ' + e.message;
            } finally {
                this.saving = false;
            }
        },

        async deleteEntry(id) {
            this.saving = true;
            try {
                await api.deleteTimeEntry(id);
                this.entries = this.entries.filter(e => e.id !== id);
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            } finally {
                this.saving = false;
            }
        },

        async addNewRow() {
            if (!this.newIssueKey.trim()) return;

            const issueKey = this.newIssueKey.trim().toUpperCase();

            // Validate format
            const match = issueKey.match(/^([A-Z0-9]+)-\d+$/);
            if (!match) {
                this.error = 'Ugyldig format. Bruk f.eks. AFP-123';
                return;
            }

            // Check if project exists
            const projectKey = match[1];
            const project = this.jiraProjects.find(p => p.key === projectKey);
            if (!project) {
                this.error = `Ukjent Jira-prosjekt: ${projectKey}`;
                return;
            }

            // Check if already exists
            if (this.entries.some(e => e.jiraIssueKey === issueKey)) {
                this.error = 'Saken er allerede lagt til';
                this.newIssueKey = '';
                return;
            }

            // Add a placeholder entry (will be saved when hours are entered)
            this.entries.push({
                id: null,
                consultantId: this.consultantId,
                jiraIssueKey: issueKey,
                jiraProjectId: project.id,
                date: `${this.year}-${String(this.month).padStart(2, '0')}-01`,
                hours: 0
            });

            this.newIssueKey = '';
            this.error = null;
        },

        getRowSum(issueKey) {
            return this.entries
                .filter(e => e.jiraIssueKey === issueKey)
                .reduce((sum, e) => sum + e.hours, 0);
        },

        getDaySum(day) {
            return this.entries
                .filter(e => new Date(e.date).getDate() === day)
                .reduce((sum, e) => sum + e.hours, 0);
        },

        getTotalSum() {
            return this.entries.reduce((sum, e) => sum + e.hours, 0);
        },

        getDistributionForIssue(issueKey) {
            // Find jira project for this issue
            const match = issueKey.match(/^([A-Z0-9]+)-/);
            if (!match) return [];

            const project = this.jiraProjects.find(p => p.key === match[1]);
            if (!project) return [];

            return project.distributionKeys;
        },

        getInvoiceProjectDaySum(invoiceProjectId, day) {
            let sum = 0;
            for (const entry of this.entries) {
                if (new Date(entry.date).getDate() !== day) continue;

                const distribution = this.getDistributionForIssue(entry.jiraIssueKey);
                const dk = distribution.find(d => d.invoiceProjectId === invoiceProjectId);
                if (dk) {
                    sum += entry.hours * (dk.percentage / 100);
                }
            }
            return sum;
        },

        getInvoiceProjectTotalSum(invoiceProjectId) {
            let sum = 0;
            for (const entry of this.entries) {
                const distribution = this.getDistributionForIssue(entry.jiraIssueKey);
                const dk = distribution.find(d => d.invoiceProjectId === invoiceProjectId);
                if (dk) {
                    sum += entry.hours * (dk.percentage / 100);
                }
            }
            return sum;
        },

        async deleteRow(issueKey) {
            const rowSum = this.getRowSum(issueKey);

            if (rowSum > 0) {
                const confirmed = confirm(`Er du sikker på at du vil slette alle timer for ${issueKey}? (${this.formatHours(rowSum)} timer)`);
                if (!confirmed) return;
            }

            this.saving = true;
            this.error = null;
            try {
                await api.deleteTimeEntriesByIssue(this.consultantId, issueKey, this.year, this.month);
                this.entries = this.entries.filter(e => e.jiraIssueKey !== issueKey);
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
