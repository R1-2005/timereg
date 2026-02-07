import api from '../services/api.js';

export default {
    name: 'AdminSystem',
    template: `
        <div class="card">
            <h2>System</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <div class="card" style="margin-bottom: 1.5rem;">
                <h3 style="margin-top: 0;">Database-status</h3>
                <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
                    <div>
                        <strong>Skjemaversjon:</strong> {{ status.schemaVersion ?? '-' }}
                    </div>
                    <div>
                        <strong>Siste backup:</strong> {{ status.lastBackupAt ? formatDateTime(status.lastBackupAt) : 'Ingen' }}
                    </div>
                    <button class="btn btn-primary" @click="createBackup" :disabled="creating">
                        {{ creating ? 'Oppretter...' : 'Ta backup nå' }}
                    </button>
                </div>
            </div>

            <h3>Backuper</h3>
            <table>
                <thead>
                    <tr>
                        <th>Filnavn</th>
                        <th>Opprettet</th>
                        <th>Skjemaversjon</th>
                        <th>Størrelse</th>
                        <th style="width: 180px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="b in backups" :key="b.filename">
                        <td>{{ b.filename }}</td>
                        <td>{{ formatDateTime(b.createdAt) }}</td>
                        <td>{{ b.schemaVersion }}</td>
                        <td>{{ formatSize(b.sizeBytes) }}</td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="restore(b)" :disabled="restoring">Gjenopprett</button>
                            <button class="btn btn-sm btn-danger" @click="remove(b)">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="backups.length === 0">
                        <td colspan="5" style="text-align: center;" class="no-data">
                            Ingen backuper
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `,
    data() {
        return {
            status: {},
            backups: [],
            error: null,
            creating: false,
            restoring: false
        };
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            try {
                const [status, backups] = await Promise.all([
                    api.getDatabaseStatus(),
                    api.getBackups()
                ]);
                this.status = status;
                this.backups = backups;
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            }
        },
        async createBackup() {
            this.error = null;
            this.creating = true;
            try {
                await api.createBackup();
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke opprette backup: ' + e.message;
            } finally {
                this.creating = false;
            }
        },
        async restore(backup) {
            if (!confirm(`Gjenopprette database fra ${backup.filename}? Alle nåværende data vil bli overskrevet.`)) return;
            this.error = null;
            this.restoring = true;
            try {
                await api.restoreBackup(backup.filename);
                await this.load();
                alert('Database gjenopprettet.');
            } catch (e) {
                this.error = 'Kunne ikke gjenopprette: ' + e.message;
            } finally {
                this.restoring = false;
            }
        },
        async remove(backup) {
            if (!confirm(`Slette ${backup.filename}?`)) return;
            this.error = null;
            try {
                await api.deleteBackup(backup.filename);
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            }
        },
        formatDateTime(isoString) {
            const d = new Date(isoString);
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
};
