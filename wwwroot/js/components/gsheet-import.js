import api from '../services/api.js';

export default {
    name: 'GSheetImport',
    template: `
        <div v-if="show" class="modal-overlay" @click.self="close">
            <div class="modal" style="max-width: 600px;">
                <h3>Importer fra Google Sheets</h3>
                <p style="margin: 0 0 12px; color: var(--color-text-muted); font-size: 14px;">Kopier cellene fra Google Sheets (inkludert header-radene) og lim inn her.</p>
                <textarea
                    v-model="gSheetText"
                    @input="onInput"
                    placeholder="Lim inn tab-separert tekst fra Google Sheets..."
                    rows="8"
                    style="width: 100%; font-family: monospace; font-size: 12px; resize: vertical; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); color: var(--color-text);"
                ></textarea>
                <div v-if="parsed" style="margin-top: 12px; font-size: 14px;">
                    <div v-if="parsed.entries.length > 0" style="color: var(--color-success, #22c55e);">
                        Fant {{ parsed.issueKeys }} saker med totalt {{ parsed.entries.length }} timeregistreringer ({{ parsed.totalHours.toFixed(1).replace('.', ',') }} timer)
                    </div>
                    <div v-else style="color: var(--color-text-muted);">
                        Ingen gyldige timeregistreringer funnet.
                    </div>
                    <div v-if="parsed.errors.length > 0" style="margin-top: 8px;">
                        <div v-for="err in parsed.errors" :key="err" style="color: var(--color-danger, #ef4444); font-size: 13px;">
                            {{ err }}
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" @click="close">Avbryt</button>
                    <button class="btn btn-primary" @click="doImport" :disabled="!parsed || parsed.entries.length === 0">
                        Importer {{ parsed && parsed.entries.length > 0 ? parsed.entries.length + ' timer' : '' }}
                    </button>
                </div>
            </div>
        </div>
    `,
    props: {
        show: { type: Boolean, default: false },
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        consultantId: { type: Number, required: true }
    },
    emits: ['close', 'imported'],
    data() {
        return {
            gSheetText: '',
            parsed: null,
            error: null
        };
    },
    watch: {
        show(val) {
            if (val) {
                this.gSheetText = '';
                this.parsed = null;
            }
        }
    },
    methods: {
        close() {
            this.$emit('close');
        },

        onInput() {
            if (!this.gSheetText.trim()) {
                this.parsed = null;
                return;
            }
            this.parsed = this.parseGoogleSheet(this.gSheetText, this.year, this.month);
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
                const val4 = row[4] ? row[4].trim() : '';
                // Check if columns starting at index 4 contain "1", "2", ...
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

        async doImport() {
            if (!this.parsed || this.parsed.entries.length === 0) return;

            try {
                await api.importTimeEntries({
                    consultantId: this.consultantId,
                    year: this.year,
                    month: this.month,
                    entries: this.parsed.entries
                });
                this.$emit('imported');
                this.close();
            } catch (e) {
                this.error = 'Import feilet: ' + e.message;
            }
        }
    }
};
