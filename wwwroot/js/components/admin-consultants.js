import api from '../services/api.js';

export default {
    name: 'AdminConsultants',
    emits: ['consultant-added'],
    template: `
        <div class="card">
            <h2>Konsulenter</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <form @submit.prevent="saveConsultant" class="card" style="background: var(--color-bg);">
                <h3>{{ editing ? 'Rediger konsulent' : 'Legg til konsulent' }}</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fornavn</label>
                        <input v-model="form.firstName" required>
                    </div>
                    <div class="form-group">
                        <label>Etternavn</label>
                        <input v-model="form.lastName" required>
                    </div>
                    <div class="form-group">
                        <label>E-post</label>
                        <input v-model="form.email" type="email" required placeholder="navn@proventus.no">
                    </div>
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
                    <div class="form-group" style="display: flex; align-items: end; padding-bottom: 0.25rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" v-model="form.isAdmin">
                            Administrator
                        </label>
                    </div>
                </div>
                <div>
                    <button type="submit" class="btn btn-primary">
                        {{ editing ? 'Oppdater' : 'Legg til' }}
                    </button>
                    <button v-if="editing" type="button" class="btn btn-secondary" @click="cancelEdit">
                        Avbryt
                    </button>
                </div>
            </form>

            <table>
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>E-post</th>
                        <th>Ansatt</th>
                        <th>Sluttet</th>
                        <th>Admin</th>
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
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="edit(c)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(c)">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="consultants.length === 0">
                        <td colspan="6" style="text-align: center; color: #666;">
                            Ingen konsulenter registrert
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `,
    data() {
        return {
            consultants: [],
            form: { firstName: '', lastName: '', email: '', isAdmin: false, employedFromMonth: '', employedToMonth: '' },
            editing: null,
            error: null
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
        async saveConsultant() {
            this.error = null;

            // Validate proventus.no email
            if (!this.form.email.toLowerCase().endsWith('@proventus.no')) {
                this.error = 'Kun @proventus.no e-postadresser er tillatt.';
                return;
            }

            const data = {
                firstName: this.form.firstName,
                lastName: this.form.lastName,
                email: this.form.email,
                isAdmin: this.form.isAdmin,
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
                this.form = { firstName: '', lastName: '', email: '', isAdmin: false, employedFromMonth: '', employedToMonth: '' };
                this.editing = null;
                await this.load();
            } catch (e) {
                this.error = 'Kunne ikke lagre: ' + e.message;
            }
        },
        edit(consultant) {
            this.editing = consultant;
            this.form = {
                firstName: consultant.firstName,
                lastName: consultant.lastName,
                email: consultant.email,
                isAdmin: consultant.isAdmin,
                employedFromMonth: this.dateToMonth(consultant.employedFrom),
                employedToMonth: this.dateToMonth(consultant.employedTo)
            };
        },
        cancelEdit() {
            this.editing = null;
            this.form = { firstName: '', lastName: '', email: '', isAdmin: false, employedFromMonth: '', employedToMonth: '' };
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
