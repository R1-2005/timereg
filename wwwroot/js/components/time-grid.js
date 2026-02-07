import api from '../services/api.js';

export default {
    name: 'TimeGrid',
    template: `
        <div class="time-grid-container">
            <div v-if="error" class="error">{{ error }}</div>
            <div v-if="saving" class="saving-indicator">Lagrer...</div>

            <!-- G-Sheet import modal -->
            <div v-if="showGSheetModal" class="modal-overlay" @click.self="closeGSheetModal">
                <div class="modal" style="max-width: 600px;">
                    <h3>Importer fra Google Sheets</h3>
                    <p style="margin: 0 0 12px; color: var(--color-text-muted); font-size: 14px;">Kopier cellene fra Google Sheets (inkludert header-radene) og lim inn her.</p>
                    <textarea
                        v-model="gSheetText"
                        @input="onGSheetInput"
                        placeholder="Lim inn tab-separert tekst fra Google Sheets..."
                        rows="8"
                        style="width: 100%; font-family: monospace; font-size: 12px; resize: vertical; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); color: var(--color-text);"
                    ></textarea>
                    <div v-if="gSheetParsed" style="margin-top: 12px; font-size: 14px;">
                        <div v-if="gSheetParsed.entries.length > 0" style="color: var(--color-success, #22c55e);">
                            Fant {{ gSheetParsed.issueKeys }} saker med totalt {{ gSheetParsed.entries.length }} timeregistreringer ({{ gSheetParsed.totalHours.toFixed(1).replace('.', ',') }} timer)
                        </div>
                        <div v-else style="color: var(--color-text-muted);">
                            Ingen gyldige timeregistreringer funnet.
                        </div>
                        <div v-if="gSheetParsed.errors.length > 0" style="margin-top: 8px;">
                            <div v-for="err in gSheetParsed.errors" :key="err" style="color: var(--color-danger, #ef4444); font-size: 13px;">
                                {{ err }}
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" @click="closeGSheetModal">Avbryt</button>
                        <button class="btn btn-primary" @click="importGSheet" :disabled="!gSheetParsed || gSheetParsed.entries.length === 0">
                            Importer {{ gSheetParsed && gSheetParsed.entries.length > 0 ? gSheetParsed.entries.length + ' timer' : '' }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="time-grid-wrapper">
                <table class="time-grid">
                    <thead>
                        <tr class="weekday-row">
                            <th class="issue-col"></th>
                            <th v-for="day in daysInMonth" :key="'wd-' + day" class="day-col" :class="{ weekend: isWeekend(day), 'weekend-text': isWeekend(day) }">
                                {{ getWeekdayShort(day) }}
                            </th>
                            <th class="sum-col"></th>
                            <th class="action-col"></th>
                        </tr>
                        <tr>
                            <th class="issue-col">Jira-sak</th>
                            <th v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day) }">
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
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day) }">
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
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day) }">
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
                            <td v-for="day in daysInMonth" :key="day" class="day-col" :class="{ weekend: isWeekend(day) }">
                                {{ formatDistribution(getInvoiceProjectDaySum(ip.id, day)) }}
                            </td>
                            <td class="sum-col">{{ formatDistribution(getInvoiceProjectTotalSum(ip.id)) }}</td>
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
            newIssueKey: '',
            error: null,
            saving: false,
            showGSheetModal: false,
            gSheetText: '',
            gSheetParsed: null
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
                const [entries, jiraProjects, invoiceProjects] = await Promise.all([
                    api.getTimeEntries(this.consultantId, this.year, this.month),
                    api.getJiraProjects(),
                    api.getInvoiceProjects()
                ]);
                this.entries = entries;
                this.jiraProjects = jiraProjects;
                this.invoiceProjects = invoiceProjects;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            }
        },

        isWeekend(day) {
            const date = new Date(this.year, this.month - 1, day);
            const dow = date.getDay();
            return dow === 0 || dow === 6;
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
            if (!hours || hours === 0) return '';
            if (this.displayMode === 'hhmm') {
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${h}:${m.toString().padStart(2, '0')}`;
            }
            return hours.toFixed(1).replace('.', ',');
        },

        formatDistribution(hours) {
            if (!hours || hours === 0) return '';
            if (this.displayMode === 'hhmm') {
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${h}:${m.toString().padStart(2, '0')}`;
            }
            return hours.toFixed(2).replace('.', ',');
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

        openGSheetModal() {
            this.gSheetText = '';
            this.gSheetParsed = null;
            this.showGSheetModal = true;
        },

        closeGSheetModal() {
            this.showGSheetModal = false;
        },

        onGSheetInput() {
            if (!this.gSheetText.trim()) {
                this.gSheetParsed = null;
                return;
            }
            this.gSheetParsed = this.parseGoogleSheet(this.gSheetText, this.year, this.month);
        },

        parseGoogleSheet(text, year, month) {
            const lines = text.split('\n').map(line => line.split('\t'));
            const entries = [];
            const errors = [];

            // Find the day-number row: a row where columns 4+ contain ascending integers 1, 2, 3...
            let dayRowIndex = -1;
            let colToDayMap = {};
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                const row = lines[i];
                if (row.length < 5) continue;
                const val3 = row[3] ? row[3].trim() : '';
                const val4 = row[4] ? row[4].trim() : '';
                // Check if columns starting at index 3 or 4 contain "1", "2", ...
                // Try starting at index 4 first (day numbers after Sum column)
                if (val4 === '1') {
                    let isValid = true;
                    const map = {};
                    for (let c = 4; c < row.length; c++) {
                        const cellVal = row[c] ? row[c].trim() : '';
                        const expectedDay = c - 3;
                        if (cellVal === '' || cellVal === String(expectedDay)) {
                            if (cellVal !== '') map[c] = parseInt(cellVal);
                        } else {
                            isValid = false;
                            break;
                        }
                    }
                    if (isValid && Object.keys(map).length > 0) {
                        dayRowIndex = i;
                        colToDayMap = map;
                        break;
                    }
                }
            }

            if (dayRowIndex === -1) {
                errors.push('Kunne ikke finne rad med dagnumre (1, 2, 3...)');
                return { entries, errors, issueKeys: 0, totalHours: 0 };
            }

            // Data rows start after the header row (which follows the day-number row)
            const dataStartIndex = dayRowIndex + 2;
            const jiraKeyRegex = /^[A-Z][A-Z0-9]+-\d+$/;
            const issueKeysSet = new Set();

            for (let i = dataStartIndex; i < lines.length; i++) {
                const row = lines[i];
                if (!row[0]) continue;
                const key = row[0].trim().toUpperCase();
                if (!jiraKeyRegex.test(key)) continue;

                issueKeysSet.add(key);

                for (const [colStr, dayNum] of Object.entries(colToDayMap)) {
                    const col = parseInt(colStr);
                    const cellVal = row[col] ? row[col].trim() : '';
                    if (!cellVal) continue;

                    const hours = parseFloat(cellVal.replace(',', '.'));
                    if (isNaN(hours) || hours <= 0) continue;

                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    entries.push({ jiraIssueKey: key, date: dateStr, hours });
                }
            }

            return {
                entries,
                errors,
                issueKeys: issueKeysSet.size,
                totalHours: entries.reduce((sum, e) => sum + e.hours, 0)
            };
        },

        async importGSheet() {
            if (!this.gSheetParsed || this.gSheetParsed.entries.length === 0) return;

            this.saving = true;
            this.error = null;
            try {
                await api.importTimeEntries({
                    consultantId: this.consultantId,
                    year: this.year,
                    month: this.month,
                    entries: this.gSheetParsed.entries
                });
                this.closeGSheetModal();
                await this.load();
            } catch (e) {
                this.error = 'Import feilet: ' + e.message;
            } finally {
                this.saving = false;
            }
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
