import api from '../services/api.js';

export default {
    name: 'AdminProjects',
    template: `
        <div class="card">
            <h2>Jira-prosjekter og fordelingsnøkler</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center;">
                <button class="btn btn-primary" @click="openModal()">
                    + Legg til Jira-prosjekt
                </button>
                <div style="margin-left: auto; display: flex; gap: 0.5rem;">
                    <a :href="exportUrl" class="btn btn-secondary" download>Eksporter JSON</a>
                    <button class="btn btn-secondary" @click="$refs.importFile.click()">Importer JSON</button>
                    <input type="file" ref="importFile" accept=".json" style="display: none;" @change="importFile">
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Nøkkel</th>
                        <th>Navn</th>
                        <th>Fordeling</th>
                        <th>Seksjon</th>
                        <th style="width: 120px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="p in jiraProjects" :key="p.id">
                        <td><strong>{{ p.key }}</strong></td>
                        <td>{{ p.name }}</td>
                        <td>
                            <span v-for="(dk, i) in p.distributionKeys" :key="dk.invoiceProjectId" class="badge badge-info" style="margin-right: 0.25rem;">
                                {{ getInvoiceProjectNumber(dk.invoiceProjectId) }}: {{ dk.percentage }}%
                            </span>
                        </td>
                        <td>
                            <span v-for="sdk in p.sectionDistributionKeys" :key="sdk.sectionId" class="badge badge-info" style="margin-right: 0.25rem;">
                                {{ getSectionName(sdk.sectionId) }}: {{ sdk.percentage }}%
                            </span>
                        </td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="openModal(p)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(p)">Slett</button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Modal -->
            <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
                <div class="modal">
                    <h3>{{ editing ? 'Rediger Jira-prosjekt' : 'Nytt Jira-prosjekt' }}</h3>

                    <div v-if="modalError" class="error">{{ modalError }}</div>

                    <div class="form-group">
                        <label>Jira-nøkkel (prefiks)</label>
                        <input v-model="form.key" placeholder="F.eks. AFP" required :disabled="editing">
                    </div>

                    <div class="form-group">
                        <label>Navn</label>
                        <input v-model="form.name" placeholder="Beskrivende navn" required>
                    </div>

                    <div class="form-group">
                        <label>Fordelingsnøkler (må summere til 100%)</label>
                        <div class="distribution-keys">
                            <div v-for="ip in invoiceProjects" :key="ip.id" class="distribution-key-input">
                                <label>{{ ip.shortName || (ip.projectNumber + ' ' + ip.name) }}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    v-model.number="form.distribution[ip.id]"
                                > %
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem; font-weight: 500;" :style="{ color: distributionSum === 100 ? 'var(--color-success-text)' : 'var(--color-error-text)' }">
                            Sum: {{ distributionSum }}%
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Seksjonsfordeling (må summere til 100%)</label>
                        <div class="distribution-keys">
                            <div v-for="s in sections" :key="s.id" class="distribution-key-input">
                                <label>{{ s.shortName || s.name }}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    v-model.number="form.sectionDistribution[s.id]"
                                > %
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem; font-weight: 500;" :style="{ color: sectionDistributionSum === 100 ? 'var(--color-success-text)' : 'var(--color-error-text)' }">
                            Sum: {{ sectionDistributionSum }}%
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" @click="closeModal">Avbryt</button>
                        <button class="btn btn-primary" @click="save" :disabled="distributionSum !== 100 || sectionDistributionSum !== 100">
                            {{ editing ? 'Oppdater' : 'Opprett' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            jiraProjects: [],
            invoiceProjects: [],
            sections: [],
            showModal: false,
            editing: null,
            form: {
                key: '',
                name: '',
                distribution: {},
                sectionDistribution: {}
            },
            error: null,
            modalError: null
        };
    },
    computed: {
        distributionSum() {
            return Object.values(this.form.distribution).reduce((sum, val) => sum + (val || 0), 0);
        },
        sectionDistributionSum() {
            return Object.values(this.form.sectionDistribution).reduce((sum, val) => sum + (val || 0), 0);
        },
        exportUrl() {
            return api.exportJiraProjectsUrl();
        }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            try {
                [this.jiraProjects, this.invoiceProjects, this.sections] = await Promise.all([
                    api.getJiraProjects(),
                    api.getInvoiceProjects(),
                    api.getSections()
                ]);
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            }
        },
        getInvoiceProjectNumber(id) {
            const ip = this.invoiceProjects.find(p => p.id === id);
            return ip ? ip.projectNumber : id;
        },
        getSectionName(id) {
            const s = this.sections.find(s => s.id === id);
            return s ? s.name : id;
        },
        openModal(project = null) {
            this.editing = project;
            this.modalError = null;

            // Initialize distribution with zeros
            this.form.distribution = {};
            this.invoiceProjects.forEach(ip => {
                this.form.distribution[ip.id] = 0;
            });

            // Initialize section distribution with zeros
            this.form.sectionDistribution = {};
            this.sections.forEach(s => {
                this.form.sectionDistribution[s.id] = 0;
            });

            if (project) {
                this.form.key = project.key;
                this.form.name = project.name;
                project.distributionKeys.forEach(dk => {
                    this.form.distribution[dk.invoiceProjectId] = dk.percentage;
                });
                project.sectionDistributionKeys.forEach(sdk => {
                    this.form.sectionDistribution[sdk.sectionId] = sdk.percentage;
                });
            } else {
                this.form.key = '';
                this.form.name = '';
                // Default: 100% on first section for new projects
                if (this.sections.length > 0) {
                    this.form.sectionDistribution[this.sections[0].id] = 100;
                }
            }

            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.editing = null;
        },
        async save() {
            this.modalError = null;

            const distributionKeys = Object.entries(this.form.distribution)
                .filter(([_, pct]) => pct > 0)
                .map(([ipId, pct]) => ({
                    invoiceProjectId: parseInt(ipId),
                    percentage: pct
                }));

            const sectionDistributionKeys = Object.entries(this.form.sectionDistribution)
                .filter(([_, pct]) => pct > 0)
                .map(([sId, pct]) => ({
                    sectionId: parseInt(sId),
                    percentage: pct
                }));

            const data = {
                key: this.form.key,
                name: this.form.name,
                distributionKeys,
                sectionDistributionKeys
            };

            try {
                if (this.editing) {
                    await api.updateJiraProject(this.editing.id, data);
                } else {
                    await api.createJiraProject(data);
                }
                this.closeModal();
                await this.load();
            } catch (e) {
                this.modalError = 'Kunne ikke lagre: ' + e.message;
            }
        },
        async importFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                const projects = data.projects || data;
                if (!Array.isArray(projects)) {
                    throw new Error('Ugyldig format: forventet en liste med prosjekter');
                }

                if (!confirm(`Importere ${projects.length} Jira-prosjekt(er)? Eksisterende prosjekter med samme nøkkel blir oppdatert.`)) {
                    return;
                }

                const result = await api.importJiraProjects({ projects });
                const messages = [];
                if (result.imported > 0) messages.push(`${result.imported} opprettet`);
                if (result.updated > 0) messages.push(`${result.updated} oppdatert`);
                if (result.errors && result.errors.length > 0) messages.push(`${result.errors.length} feil`);
                alert('Import fullført: ' + messages.join(', '));

                await this.load();
            } catch (e) {
                this.error = 'Import feilet: ' + e.message;
            } finally {
                event.target.value = '';
            }
        },
        async remove(project) {
            if (!confirm(`Slette Jira-prosjekt ${project.key}?`)) {
                return;
            }
            try {
                await api.deleteJiraProject(project.id);
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            }
        }
    }
};
