import api from './services/api.js';
import Login from './components/login.js';
import Home from './components/home.js';
import AdminConsultants from './components/admin-consultants.js';
import AdminProjects from './components/admin-projects.js';
import MonthPicker from './components/month-picker.js';
import TimeGrid from './components/time-grid.js';
import ReportView from './components/report-view.js';

const { createApp, ref, onMounted } = Vue;

const App = {
    components: {
        Login,
        Home,
        AdminConsultants,
        AdminProjects,
        MonthPicker,
        TimeGrid,
        ReportView
    },
    template: `
        <div v-if="loading" class="loading-container">
            <div class="loading">Laster...</div>
        </div>

        <div v-else-if="noConsultants">
            <nav class="nav">
                <ul class="nav-tabs">
                    <li>
                        <a href="#" class="active">Admin</a>
                    </li>
                </ul>
            </nav>
            <div class="container">
                <div class="card" style="background: #fffbeb; border-color: #fde68a;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>Velkommen!</strong> Ingen konsulenter er registrert ennå. Legg til minst én konsulent for å komme i gang.
                    </p>
                </div>
                <AdminConsultants @consultant-added="checkConsultants" />
            </div>
        </div>

        <div v-else-if="!consultant">
            <Login @login="onLogin" />
        </div>

        <div v-else>
            <nav class="nav">
                <ul class="nav-tabs">
                    <li>
                        <a href="#" :class="{ active: tab === 'hjem' }" @click.prevent="tab = 'hjem'">
                            Hjem
                        </a>
                    </li>
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
                    <li v-if="consultant.isAdmin">
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
                <div v-if="tab === 'hjem'">
                    <Home />
                </div>

                <div v-if="tab === 'timeregistrering'">
                    <div class="time-header">
                        <MonthPicker
                            :year="selectedYear"
                            :month="selectedMonth"
                            @update:year="selectedYear = $event"
                            @update:month="selectedMonth = $event"
                        />
                        <div class="time-header-actions">
                            <select v-model="displayMode" class="display-mode-select">
                                <option value="hhmm">Timer som hh:mm</option>
                                <option value="decimal">Timer som desimaltall</option>
                            </select>
                            <button class="btn btn-secondary" @click="exportJson">
                                Eksporter JSON
                            </button>
                            <label class="btn btn-secondary import-btn">
                                Importer JSON
                                <input type="file" accept=".json" @change="importJson" hidden>
                            </label>
                        </div>
                    </div>
                    <TimeGrid
                        ref="timeGrid"
                        :consultant-id="consultant.id"
                        :year="selectedYear"
                        :month="selectedMonth"
                        :display-mode="displayMode"
                    />
                </div>

                <div v-if="tab === 'rapport'">
                    <ReportView />
                </div>

                <div v-if="tab === 'admin'">
                    <AdminConsultants />
                    <AdminProjects />
                </div>
            </div>
        </div>
    `,
    setup() {
        const loading = ref(true);
        const noConsultants = ref(false);
        const consultant = ref(null);
        const tab = ref('hjem');

        const now = new Date();
        const selectedYear = ref(now.getFullYear());
        const selectedMonth = ref(now.getMonth() + 1);
        const displayMode = ref('decimal');

        const checkConsultants = async () => {
            try {
                const consultants = await api.getConsultants();
                noConsultants.value = consultants.length === 0;
            } catch (e) {
                console.error('Could not check consultants:', e);
            }
        };

        onMounted(async () => {
            await checkConsultants();

            if (!noConsultants.value) {
                const saved = localStorage.getItem('consultant');
                if (saved) {
                    consultant.value = JSON.parse(saved);
                }
            }

            loading.value = false;
        });

        const onLogin = (c) => {
            consultant.value = c;
        };

        const logout = () => {
            localStorage.removeItem('consultant');
            consultant.value = null;
        };

        const timeGrid = ref(null);

        const exportJson = () => {
            const url = `/api/time-entries/export?consultantId=${consultant.value.id}&year=${selectedYear.value}&month=${selectedMonth.value}`;
            window.location.href = url;
        };

        const importJson = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const confirmed = confirm('Dette vil overskrive alle eksisterende timer for denne måneden. Fortsette?');
            if (!confirmed) {
                event.target.value = '';
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                const importData = {
                    consultantId: consultant.value.id,
                    year: selectedYear.value,
                    month: selectedMonth.value,
                    entries: data.entries.map(e => ({
                        jiraIssueKey: e.jiraIssueKey,
                        date: e.date,
                        hours: e.hours
                    }))
                };

                const result = await api.importTimeEntries(importData);

                if (result.errors && result.errors.length > 0) {
                    alert(`Importert ${result.imported} timer. Feil: ${result.errors.join(', ')}`);
                } else {
                    alert(`Importert ${result.imported} timer.`);
                }

                if (timeGrid.value) {
                    timeGrid.value.load();
                }
            } catch (e) {
                alert('Kunne ikke importere: ' + e.message);
            } finally {
                event.target.value = '';
            }
        };

        return {
            loading,
            noConsultants,
            consultant,
            tab,
            selectedYear,
            selectedMonth,
            displayMode,
            checkConsultants,
            onLogin,
            logout,
            timeGrid,
            exportJson,
            importJson
        };
    }
};

createApp(App).mount('#app');
