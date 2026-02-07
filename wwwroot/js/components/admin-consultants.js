import api from '../services/api.js';
import { MONTH_NAMES_SHORT } from '../utils/formatting.js';

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
                        <th>Arbeidsgiver</th>
                        <th>E-post</th>
                        <th>Ansatt</th>
                        <th>Sluttet</th>
                        <th>Admin</th>
                        <th>Timer</th>
                        <th>Aktiv</th>
                        <th style="width: 120px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="c in consultants" :key="c.id">
                        <td>{{ c.firstName }} {{ c.lastName }}</td>
                        <td>{{ c.employerName || '' }}</td>
                        <td>{{ c.email }}</td>
                        <td>{{ formatMonth(c.employedFrom) }}</td>
                        <td>{{ formatMonth(c.employedTo) }}</td>
                        <td><span class="status-badge" :class="c.isAdmin ? 'status-yes' : 'status-no'">{{ c.isAdmin ? 'Ja' : 'Nei' }}</span></td>
                        <td><span class="status-badge" :class="c.canRegisterHours ? 'status-yes' : 'status-no'">{{ c.canRegisterHours ? 'Ja' : 'Nei' }}</span></td>
                        <td><span class="status-badge" :class="c.isActive ? 'status-yes' : 'status-no'">{{ c.isActive ? 'Ja' : 'Nei' }}</span></td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="openModal(c)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(c)" :disabled="hasHours(c.id)" :title="hasHours(c.id) ? 'Kan ikke slettes — har timeregistreringer. Deaktiver i stedet.' : ''">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="consultants.length === 0">
                        <td colspan="9" style="text-align: center;" class="no-data">
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
                        <label>Arbeidsgiver</label>
                        <select v-model="form.employerId" required>
                            <option :value="null" disabled>Velg arbeidsgiver</option>
                            <option v-for="e in employers" :key="e.id" :value="e.id">{{ e.name }}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>E-post</label>
                        <input v-model="form.email" type="email" required :placeholder="emailPlaceholder">
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
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" v-model="form.isActive">
                                Aktiv
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
            consultantIdsWithHours: [],
            employers: [],
            form: { firstName: '', lastName: '', email: '', isAdmin: false, canRegisterHours: true, isActive: true, employedFromMonth: '', employedToMonth: '', employerId: null },
            showModal: false,
            editing: null,
            error: null,
            modalError: null
        };
    },
    computed: {
        emailPlaceholder() {
            const employer = this.employers.find(e => e.id === this.form.employerId);
            return employer ? `navn@${employer.emailDomain}` : 'Velg arbeidsgiver først';
        }
    },
    async mounted() {
        await this.load();
    },
    methods: {
        async load() {
            try {
                const [consultants, idsWithHours, employers] = await Promise.all([
                    api.getConsultants(),
                    api.getConsultantsWithTimeEntries(),
                    api.getEmployers()
                ]);
                this.consultants = consultants;
                this.consultantIdsWithHours = idsWithHours;
                this.employers = employers;
            } catch (e) {
                this.error = 'Kunne ikke laste konsulenter: ' + e.message;
            }
        },
        hasHours(consultantId) {
            return this.consultantIdsWithHours.includes(consultantId);
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
                    isActive: consultant.isActive,
                    employedFromMonth: this.dateToMonth(consultant.employedFrom),
                    employedToMonth: this.dateToMonth(consultant.employedTo),
                    employerId: consultant.employerId
                };
            } else {
                this.form = { firstName: '', lastName: '', email: '', isAdmin: false, canRegisterHours: true, isActive: true, employedFromMonth: '', employedToMonth: '', employerId: null };
            }

            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.editing = null;
        },
        async saveConsultant() {
            this.modalError = null;

            // Validate employer is selected
            if (!this.form.employerId) {
                this.modalError = 'Velg en arbeidsgiver.';
                return;
            }

            // Validate email domain matches employer
            const employer = this.employers.find(e => e.id === this.form.employerId);
            if (employer && !this.form.email.toLowerCase().endsWith('@' + employer.emailDomain.toLowerCase())) {
                this.modalError = `E-postadressen må slutte med @${employer.emailDomain}.`;
                return;
            }

            const data = {
                firstName: this.form.firstName,
                lastName: this.form.lastName,
                email: this.form.email,
                isAdmin: this.form.isAdmin,
                canRegisterHours: this.form.canRegisterHours,
                isActive: this.form.isActive,
                employedFrom: this.monthToFirstDay(this.form.employedFromMonth),
                employedTo: this.monthToLastDay(this.form.employedToMonth),
                employerId: this.form.employerId
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
            return MONTH_NAMES_SHORT[parseInt(month) - 1] + ' ' + year;
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
