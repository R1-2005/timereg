import api from '../services/api.js';

export default {
    name: 'AdminEmployers',
    template: `
        <div class="card">
            <h2>Arbeidsgivere</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <div style="margin-bottom: 1rem;">
                <button class="btn btn-primary" @click="openModal()">
                    + Legg til arbeidsgiver
                </button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>Org.nr.</th>
                        <th>E-postdomene</th>
                        <th>Adresse</th>
                        <th style="width: 120px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="e in employers" :key="e.id">
                        <td>{{ e.name }}</td>
                        <td>{{ e.orgNumber }}</td>
                        <td>{{ e.emailDomain }}</td>
                        <td>{{ formatAddress(e) }}</td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="openModal(e)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(e)" :disabled="hasConsultants(e.id)" :title="hasConsultants(e.id) ? 'Kan ikke slettes — har konsulenter.' : ''">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="employers.length === 0">
                        <td colspan="5" style="text-align: center;" class="no-data">
                            Ingen arbeidsgivere registrert
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Modal -->
            <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
                <div class="modal">
                    <h3>{{ editing ? 'Rediger arbeidsgiver' : 'Ny arbeidsgiver' }}</h3>

                    <div v-if="modalError" class="error">{{ modalError }}</div>

                    <div class="form-group">
                        <label>Navn</label>
                        <input v-model="form.name" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Organisasjonsnummer</label>
                            <input v-model="form.orgNumber" required pattern="\\d{9}" placeholder="9 siffer">
                        </div>
                        <div class="form-group">
                            <label>E-postdomene</label>
                            <input v-model="form.emailDomain" required placeholder="f.eks. proventus.no">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Adresse</label>
                        <input v-model="form.address">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Postnummer</label>
                            <input v-model="form.postalCode">
                        </div>
                        <div class="form-group">
                            <label>Sted</label>
                            <input v-model="form.city">
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" @click="closeModal">Avbryt</button>
                        <button class="btn btn-primary" @click="saveEmployer">
                            {{ editing ? 'Oppdater' : 'Opprett' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            employers: [],
            employerIdsWithConsultants: [],
            form: { name: '', orgNumber: '', emailDomain: '', address: '', postalCode: '', city: '' },
            showModal: false,
            editing: null,
            error: null,
            modalError: null
        };
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            try {
                const [employers, idsWithConsultants] = await Promise.all([
                    api.getEmployers(),
                    api.getEmployersWithConsultants()
                ]);
                this.employers = employers;
                this.employerIdsWithConsultants = idsWithConsultants;
            } catch (e) {
                this.error = 'Kunne ikke laste arbeidsgivere: ' + e.message;
            }
        },
        hasConsultants(employerId) {
            return this.employerIdsWithConsultants.includes(employerId);
        },
        formatAddress(employer) {
            const parts = [employer.address, employer.postalCode, employer.city].filter(Boolean);
            if (parts.length === 0) return '';
            if (employer.postalCode && employer.city) {
                return employer.address
                    ? `${employer.address}, ${employer.postalCode} ${employer.city}`
                    : `${employer.postalCode} ${employer.city}`;
            }
            return parts.join(', ');
        },
        openModal(employer = null) {
            this.editing = employer;
            this.modalError = null;

            if (employer) {
                this.form = {
                    name: employer.name,
                    orgNumber: employer.orgNumber,
                    emailDomain: employer.emailDomain,
                    address: employer.address || '',
                    postalCode: employer.postalCode || '',
                    city: employer.city || ''
                };
            } else {
                this.form = { name: '', orgNumber: '', emailDomain: '', address: '', postalCode: '', city: '' };
            }

            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.editing = null;
        },
        async saveEmployer() {
            this.modalError = null;

            if (!this.form.name.trim()) {
                this.modalError = 'Navn er påkrevd.';
                return;
            }
            if (!/^\d{9}$/.test(this.form.orgNumber)) {
                this.modalError = 'Organisasjonsnummer må være 9 siffer.';
                return;
            }
            if (!this.form.emailDomain.trim()) {
                this.modalError = 'E-postdomene er påkrevd.';
                return;
            }

            const data = {
                name: this.form.name,
                orgNumber: this.form.orgNumber,
                emailDomain: this.form.emailDomain,
                address: this.form.address || null,
                postalCode: this.form.postalCode || null,
                city: this.form.city || null
            };

            try {
                if (this.editing) {
                    await api.updateEmployer(this.editing.id, data);
                } else {
                    await api.createEmployer(data);
                }
                this.closeModal();
                await this.load();
            } catch (e) {
                this.modalError = 'Kunne ikke lagre: ' + e.message;
            }
        },
        async remove(employer) {
            if (!confirm(`Slette ${employer.name}?`)) {
                return;
            }
            try {
                await api.deleteEmployer(employer.id);
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            }
        }
    }
};
