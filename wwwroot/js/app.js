import Login from './components/login.js';
import AdminConsultants from './components/admin-consultants.js';
import AdminProjects from './components/admin-projects.js';

const { createApp, ref, computed, onMounted } = Vue;

const App = {
    components: {
        Login,
        AdminConsultants,
        AdminProjects
    },
    template: `
        <div v-if="!consultant">
            <Login @login="onLogin" />
        </div>

        <div v-else>
            <nav class="nav">
                <ul class="nav-tabs">
                    <li>
                        <a href="#" :class="{ active: tab === 'timeregistrering' }" @click.prevent="tab = 'timeregistrering'">
                            Timeregistrering
                        </a>
                    </li>
                    <li>
                        <a href="#" :class="{ active: tab === 'rapport' }" @click.prevent="tab = 'rapport'">
                            Rapport
                        </a>
                    </li>
                    <li>
                        <a href="#" :class="{ active: tab === 'admin' }" @click.prevent="tab = 'admin'">
                            Admin
                        </a>
                    </li>
                </ul>
                <div class="nav-right">
                    <span>{{ consultant.firstName }} {{ consultant.lastName }}</span>
                    <button @click="logout">Logg ut</button>
                </div>
            </nav>

            <div class="container">
                <div v-if="tab === 'timeregistrering'">
                    <div class="card">
                        <h2>Timeregistrering</h2>
                        <p style="color: #666;">Kommer i Fase 3</p>
                    </div>
                </div>

                <div v-if="tab === 'rapport'">
                    <div class="card">
                        <h2>Rapport</h2>
                        <p style="color: #666;">Kommer i Fase 4</p>
                    </div>
                </div>

                <div v-if="tab === 'admin'">
                    <AdminConsultants />
                    <AdminProjects />
                </div>
            </div>
        </div>
    `,
    setup() {
        const consultant = ref(null);
        const tab = ref('timeregistrering');

        onMounted(() => {
            const saved = localStorage.getItem('consultant');
            if (saved) {
                consultant.value = JSON.parse(saved);
            }
        });

        const onLogin = (c) => {
            consultant.value = c;
        };

        const logout = () => {
            localStorage.removeItem('consultant');
            consultant.value = null;
        };

        return {
            consultant,
            tab,
            onLogin,
            logout
        };
    }
};

createApp(App).mount('#app');
