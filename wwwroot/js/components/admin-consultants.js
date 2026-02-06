import api from '../services/api.js';

export default {
    name: 'AdminConsultants',
    emits: ['consultant-added'],
    template: `
        <div class="card">
            <h2>Konsulenter</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <div style="margin-bottom: 1rem;">
                <button class="btn btn-primary" @click="openModal()">
                    + Legg til konsulent
                </button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>E-post</th>
                        <th>Ansatt</th>
                        <th>Sluttet</th>
                        <th>Admin</th>
                        <th>Timer</th>
                        <th style="width: 120px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="c in consultants" :key="c.id">
                        <td>{{ c.firstName }} {{ c.lastName }}</td>
                        <td>{{ c.email }}</td>
                        <td>{{ formatMonth(c.employedFrom) }}</td>
                        <td>{{ formatMonth(c.employedTo) }}</td>
                        <td>{{ c.isAdmin ? 'Ja' : '' }}</td>
                        <td>{{ c.canRegisterHours ? 'Ja' : 'Nei' }}</td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="openModal(c)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(c)">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="consultants.length === 0">
                        <td colspan="7" style="text-align: center;" class="no-data">
                            Ingen konsulenter registrert
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Modal -->
            <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
                <div class="modal">
                    <h3>{{ editing ? 'Rediger konsulent' : 'Ny konsulent' }}</h3>

                    <div v-if="modalError" class="error">{{ modalError }}</div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Fornavn</label>
                            <input v-model="form.firstName" required>
                        </div>
                        <div class="form-group">
                            <label>Etternavn</label>
                            <input v-model="form.lastName" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>E-post</label>
                        <input v-model="form.email" type="email" required placeholder="navn@proventus.no">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Ansatt fra og med</label>
                            <input type="month" v-model="form.employedFromMonth" required>
                        </div>
                        <div class="form-group">
                            <label>Ansatt til og med</label>
                            <input type="month" v-model="form.employedToMonth">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" v-model="form.isAdmin">
                                Administrator
                            </label>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" v-model="form.canRegisterHours">
                                Timeføring
                            </label>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" @click="closeModal">Avbryt</button>
                        <button class="btn btn-primary" @click="saveConsultant">
                            {{ editing ? 'Oppdater' : 'Opprett' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            consultants: [],
            form: { firstName: '', lastName: '', email: '', isAdmin: false, canRegisterHours: true, employedFromMonth: '', employedToMonth: '' },
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
                this.consultants = await api.getConsultants();
            } catch (e) {
                this.error = 'Kunne ikke laste konsulenter: ' + e.message;
            }
        },
        openModal(consultant = null) {
            this.editing = consultant;
            this.modalError = null;

            if (consultant) {
                this.form = {
                    firstName: consultant.firstName,
                    lastName: consultant.lastName,
                    email: consultant.email,
                    isAdmin: consultant.isAdmin,
                    canRegisterHours: consultant.canRegisterHours,
                    employedFromMonth: this.dateToMonth(consultant.employedFrom),
                    employedToMonth: this.dateToMonth(consultant.employedTo)
                };
            } else {
                this.form = { firstName: '', lastName: '', email: '', isAdmin: false, canRegisterHours: true, employedFromMonth: '', employedToMonth: '' };
            }

            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.editing = null;
        },
        async saveConsultant() {
            this.modalError = null;

            // Validate proventus.no email
            if (!this.form.email.toLowerCase().endsWith('@proventus.no')) {
                this.modalError = 'Kun @proventus.no e-postadresser er tillatt.';
                return;
            }

            const data = {
                firstName: this.form.firstName,
                lastName: this.form.lastName,
                email: this.form.email,
                isAdmin: this.form.isAdmin,
                canRegisterHours: this.form.canRegisterHours,
                employedFrom: this.monthToFirstDay(this.form.employedFromMonth),
                employedTo: this.monthToLastDay(this.form.employedToMonth)
            };

            try {
                if (this.editing) {
                    await api.updateConsultant(this.editing.id, data);
                } else {
                    await api.createConsultant(data);
                    this.$emit('consultant-added');
                }
                this.closeModal();
                await this.load();
            } catch (e) {
                this.modalError = 'Kunne ikke lagre: ' + e.message;
            }
        },
        monthToFirstDay(monthStr) {
            if (!monthStr) return null;
            return monthStr + '-01';
        },
        monthToLastDay(monthStr) {
            if (!monthStr) return null;
            const [year, month] = monthStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            return monthStr + '-' + String(lastDay).padStart(2, '0');
        },
        dateToMonth(dateStr) {
            if (!dateStr) return '';
            return dateStr.substring(0, 7);
        },
        formatMonth(dateStr) {
            if (!dateStr) return '';
            const [year, month] = dateStr.substring(0, 7).split('-');
            const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
            return months[parseInt(month) - 1] + ' ' + year;
        },
        async remove(consultant) {
            if (!confirm(`Slette ${consultant.firstName} ${consultant.lastName}? Dette vil også slette alle timeregistreringer.`)) {
                return;
            }
            try {
                await api.deleteConsultant(consultant.id);
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke slette: ' + e.message;
            }
        }
    }
};
