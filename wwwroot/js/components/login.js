import api from '../services/api.js';

export default {
    name: 'Login',
    template: `
        <div class="login-container">
            <div class="card">
                <h1>Timeregistrering</h1>

                <div v-if="error" class="error">{{ error }}</div>

                <form @submit.prevent="login">
                    <div class="form-group">
                        <label>Fornavn</label>
                        <input v-model="firstName" required autofocus>
                    </div>

                    <div class="form-group">
                        <label>E-post</label>
                        <input v-model="email" type="email" required>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                        Logg inn
                    </button>
                </form>
            </div>
        </div>
    `,
    data() {
        return {
            firstName: '',
            email: '',
            error: null
        };
    },
    mounted() {
        // Check for saved credentials
        const saved = localStorage.getItem('consultant');
        if (saved) {
            const consultant = JSON.parse(saved);
            this.firstName = consultant.firstName;
            this.email = consultant.email;
        }
    },
    methods: {
        async login() {
            this.error = null;

            // Validate proventus.no email
            if (!this.email.toLowerCase().endsWith('@proventus.no')) {
                this.error = 'Kun @proventus.no e-postadresser er tillatt.';
                return;
            }

            try {
                const consultant = await api.login(this.firstName, this.email);
                localStorage.setItem('consultant', JSON.stringify(consultant));
                this.$emit('login', consultant);
            } catch (e) {
                if (e.message.includes('401')) {
                    this.error = 'Ukjent bruker. Sjekk fornavn og e-post.';
                } else {
                    this.error = 'Innlogging feilet: ' + e.message;
                }
            }
        }
    }
};
