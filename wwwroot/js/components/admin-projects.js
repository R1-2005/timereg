import api from '../services/api.js';

export default {
    name: 'AdminProjects',
    template: `
        <div class="card">
            <h2>Jira-prosjekter og fordelingsnøkler</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <button class="btn btn-primary" @click="openModal()" style="margin-bottom: 1rem;">
                + Legg til Jira-prosjekt
            </button>

            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Nøkkel</th>
                        <th>Navn</th>
                        <th>Fordeling</th>
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
                                <label>{{ ip.projectNumber }}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    v-model.number="form.distribution[ip.id]"
                                > %
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem; font-weight: 500;" :style="{ color: distributionSum === 100 ? '#27ae60' : '#e74c3c' }">
                            Sum: {{ distributionSum }}%
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" @click="closeModal">Avbryt</button>
                        <button class="btn btn-primary" @click="save" :disabled="distributionSum !== 100">
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
            showModal: false,
            editing: null,
            form: {
                key: '',
                name: '',
                distribution: {}
            },
            error: null,
            modalError: null
        };
    },
    computed: {
        distributionSum() {
            return Object.values(this.form.distribution).reduce((sum, val) => sum + (val || 0), 0);
        }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            try {
                [this.jiraProjects, this.invoiceProjects] = await Promise.all([
                    api.getJiraProjects(),
                    api.getInvoiceProjects()
                ]);
            } catch (e) {
                this.error = 'Kunne ikke laste data: ' + e.message;
            }
        },
        getInvoiceProjectNumber(id) {
            const ip = this.invoiceProjects.find(p => p.id === id);
            return ip ? ip.projectNumber : id;
        },
        openModal(project = null) {
            this.editing = project;
            this.modalError = null;

            // Initialize distribution with zeros
            this.form.distribution = {};
            this.invoiceProjects.forEach(ip => {
                this.form.distribution[ip.id] = 0;
            });

            if (project) {
                this.form.key = project.key;
                this.form.name = project.name;
                project.distributionKeys.forEach(dk => {
                    this.form.distribution[dk.invoiceProjectId] = dk.percentage;
                });
            } else {
                this.form.key = '';
                this.form.name = '';
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

            const data = {
                key: this.form.key,
                name: this.form.name,
                distributionKeys
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
