import api from './services/api.js';
import Login from './components/login.js';
import Home from './components/home.js';
import AdminEmployers from './components/admin-employers.js';
import AdminConsultants from './components/admin-consultants.js';
import AdminProjects from './components/admin-projects.js';
import MonthPicker from './components/month-picker.js';
import TimeGrid from './components/time-grid.js';
import GSheetImport from './components/gsheet-import.js';
import ReportView from './components/report-view.js';

const { createApp, ref, watch, onMounted, onBeforeUnmount } = Vue;

const App = {
    components: {
        Login,
        Home,
        AdminEmployers,
        AdminConsultants,
        AdminProjects,
        MonthPicker,
        TimeGrid,
        GSheetImport,
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
                <div class="card" style="background: var(--color-warning-bg); border-color: var(--color-warning-border);">
                    <p style="margin: 0; color: var(--color-warning-text);">
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
                    <li v-if="consultant.canRegisterHours">
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
                <div v-if="tab !== 'admin'" class="nav-center">
                    <MonthPicker
                        :year="selectedYear"
                        :month="selectedMonth"
                        @update:year="selectedYear = $event"
                        @update:month="selectedMonth = $event"
                    />
                </div>
                <div class="nav-right">
                    <span>{{ consultant.firstName }} {{ consultant.lastName }}</span>
                    <button @click="toggleTheme" class="theme-toggle" :title="darkMode ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'">
                        {{ darkMode ? '\u2600\uFE0F' : '\uD83C\uDF19' }}
                    </button>
                    <button @click="logout">Logg ut</button>
                </div>
            </nav>

            <div class="container">
                <div v-if="tab === 'hjem'">
                    <Home :year="selectedYear" :month="selectedMonth" />
                </div>

                <div v-if="tab === 'timeregistrering'">
                    <div class="time-header">
                        <div class="time-header-actions">
                            <select v-model="displayMode" class="display-mode-select">
                                <option value="hhmm">Timer som hh:mm</option>
                                <option value="decimal">Timer som desimaltall</option>
                            </select>
                            <button
                                class="btn"
                                :class="isMonthLocked ? 'btn-lock-undo' : 'btn-lock'"
                                @click="toggleMonthLock"
                            >
                                {{ isMonthLocked ? '\uD83D\uDD13 Lås opp timeark' : '\uD83D\uDD12 Lås timeark' }}
                            </button>
                            <div class="overflow-menu" ref="overflowMenuRef">
                                <button class="btn btn-secondary" @click="showOverflowMenu = !showOverflowMenu" title="Eksport og import">
                                    ⋯
                                </button>
                                <div v-if="showOverflowMenu" class="overflow-menu-dropdown">
                                    <button v-if="!isMonthLocked && consultant.isAdmin" class="overflow-menu-item" @click="openGSheetImport(); showOverflowMenu = false">
                                        Importer fra G-Sheet
                                    </button>
                                    <button class="overflow-menu-item" @click="exportExcel(); showOverflowMenu = false">
                                        Eksporter Excel
                                    </button>
                                    <button class="overflow-menu-item" @click="exportJson(); showOverflowMenu = false">
                                        Eksporter JSON
                                    </button>
                                    <label v-if="!isMonthLocked" class="overflow-menu-item" @click="showOverflowMenu = false">
                                        Importer JSON
                                        <input type="file" accept=".json" @change="importJson" hidden>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <TimeGrid
                        ref="timeGrid"
                        :consultant-id="consultant.id"
                        :year="selectedYear"
                        :month="selectedMonth"
                        :display-mode="displayMode"
                        :locked="isMonthLocked"
                    />
                    <GSheetImport
                        :show="showGSheetImport"
                        :year="selectedYear"
                        :month="selectedMonth"
                        :consultant-id="consultant.id"
                        @close="showGSheetImport = false"
                        @imported="onGSheetImported"
                    />
                </div>

                <div v-if="tab === 'rapport'">
                    <ReportView :year="selectedYear" :month="selectedMonth" />
                </div>

                <div v-if="tab === 'admin'">
                    <ul class="sub-tabs">
                        <li><a href="#" :class="{ active: adminTab === 'prosjekter' }" @click.prevent="adminTab = 'prosjekter'">Jira-prosjekter</a></li>
                        <li><a href="#" :class="{ active: adminTab === 'konsulenter' }" @click.prevent="adminTab = 'konsulenter'">Konsulenter</a></li>
                        <li><a href="#" :class="{ active: adminTab === 'arbeidsgivere' }" @click.prevent="adminTab = 'arbeidsgivere'">Arbeidsgivere</a></li>
                    </ul>
                    <AdminProjects v-if="adminTab === 'prosjekter'" />
                    <AdminConsultants v-if="adminTab === 'konsulenter'" />
                    <AdminEmployers v-if="adminTab === 'arbeidsgivere'" />
                </div>
            </div>
        </div>
    `,
    setup() {
        const loading = ref(true);
        const noConsultants = ref(false);
        const consultant = ref(null);
        const tab = ref('hjem');
        const adminTab = ref('prosjekter');
        const darkMode = ref(localStorage.getItem('theme') === 'dark');

        const applyTheme = () => {
            document.documentElement.dataset.theme = darkMode.value ? 'dark' : 'light';
        };

        const toggleTheme = () => {
            darkMode.value = !darkMode.value;
            localStorage.setItem('theme', darkMode.value ? 'dark' : 'light');
            applyTheme();
        };

        const now = new Date();
        const selectedYear = ref(now.getFullYear());
        const selectedMonth = ref(now.getMonth() + 1);
        const displayMode = ref('decimal');
        const isMonthLocked = ref(false);

        const loadLockStatus = async () => {
            if (!consultant.value) return;
            try {
                const result = await api.getMonthlyLock(consultant.value.id, selectedYear.value, selectedMonth.value);
                isMonthLocked.value = result.isLocked;
            } catch (e) {
                console.error('Could not load lock status:', e);
            }
        };

        const toggleMonthLock = async () => {
            if (!consultant.value) return;
            const newLocked = !isMonthLocked.value;

            if (newLocked) {
                const confirmed = confirm('Marker måneden som ferdig? Timer vil bli skrivebeskyttet.');
                if (!confirmed) return;
            }

            try {
                const result = await api.setMonthlyLock(consultant.value.id, selectedYear.value, selectedMonth.value, newLocked);
                isMonthLocked.value = result.isLocked;
            } catch (e) {
                alert('Kunne ikke endre status: ' + e.message);
            }
        };

        const checkConsultants = async () => {
            try {
                const consultants = await api.getConsultants();
                noConsultants.value = consultants.length === 0;
            } catch (e) {
                console.error('Could not check consultants:', e);
            }
        };

        onMounted(async () => {
            applyTheme();
            document.addEventListener('click', handleClickOutside);
            await checkConsultants();

            if (!noConsultants.value) {
                const saved = localStorage.getItem('consultant');
                if (saved) {
                    consultant.value = JSON.parse(saved);
                    await loadLockStatus();
                }
            }

            loading.value = false;
        });

        onBeforeUnmount(() => {
            document.removeEventListener('click', handleClickOutside);
        });

        watch([selectedYear, selectedMonth], () => {
            loadLockStatus();
        });

        const onLogin = (c) => {
            consultant.value = c;
            loadLockStatus();
        };

        const logout = () => {
            localStorage.removeItem('consultant');
            consultant.value = null;
        };

        const timeGrid = ref(null);
        const showGSheetImport = ref(false);
        const showOverflowMenu = ref(false);
        const overflowMenuRef = ref(null);

        const handleClickOutside = (event) => {
            if (overflowMenuRef.value && !overflowMenuRef.value.contains(event.target)) {
                showOverflowMenu.value = false;
            }
        };

        const openGSheetImport = () => {
            showGSheetImport.value = true;
        };

        const onGSheetImported = () => {
            if (timeGrid.value) {
                timeGrid.value.load();
            }
        };

        const exportJson = () => {
            const url = `/api/time-entries/export?consultantId=${consultant.value.id}&year=${selectedYear.value}&month=${selectedMonth.value}`;
            window.location.href = url;
        };

        const exportExcel = () => {
            const url = `/api/time-entries/export/excel?consultantId=${consultant.value.id}&year=${selectedYear.value}&month=${selectedMonth.value}`;
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
            adminTab,
            darkMode,
            toggleTheme,
            selectedYear,
            selectedMonth,
            displayMode,
            isMonthLocked,
            checkConsultants,
            onLogin,
            logout,
            toggleMonthLock,
            timeGrid,
            showGSheetImport,
            showOverflowMenu,
            overflowMenuRef,
            openGSheetImport,
            onGSheetImported,
            exportJson,
            exportExcel,
            importJson
        };
    }
};

createApp(App).mount('#app');
