import api from '../services/api.js';

export default {
    name: 'AdminConsultants',
    template: `
        <div class="card">
            <h2>Konsulenter</h2>

            <div v-if="error" class="error">{{ error }}</div>

            <form @submit.prevent="saveConsultant" class="card" style="background: #f8f9fa;">
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
                        <input v-model="form.email" type="email" required>
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
                        <th style="width: 120px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="c in consultants" :key="c.id">
                        <td>{{ c.firstName }} {{ c.lastName }}</td>
                        <td>{{ c.email }}</td>
                        <td class="actions">
                            <button class="btn btn-sm btn-secondary" @click="edit(c)">Rediger</button>
                            <button class="btn btn-sm btn-danger" @click="remove(c)">Slett</button>
                        </td>
                    </tr>
                    <tr v-if="consultants.length === 0">
                        <td colspan="3" style="text-align: center; color: #666;">
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
            form: { firstName: '', lastName: '', email: '' },
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
            try {
                if (this.editing) {
                    await api.updateConsultant(this.editing.id, this.form);
                } else {
                    await api.createConsultant(this.form);
                }
                this.form = { firstName: '', lastName: '', email: '' };
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
                email: consultant.email
            };
        },
        cancelEdit() {
            this.editing = null;
            this.form = { firstName: '', lastName: '', email: '' };
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
