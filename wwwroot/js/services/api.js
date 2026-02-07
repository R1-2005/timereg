const api = {
    async get(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    async post(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    },

    async put(url, data) {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    },

    async delete(url) {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return true;
    },

    // Consultants
    getConsultants: () => api.get('/api/consultants'),
    getConsultantsWithTimeEntries: () => api.get('/api/consultants/with-time-entries'),
    createConsultant: (data) => api.post('/api/consultants', data),
    updateConsultant: (id, data) => api.put(`/api/consultants/${id}`, data),
    deleteConsultant: (id) => api.delete(`/api/consultants/${id}`),

    // Employers
    getEmployers: () => api.get('/api/employers'),
    getEmployersWithConsultants: () => api.get('/api/employers/with-consultants'),
    createEmployer: (data) => api.post('/api/employers', data),
    updateEmployer: (id, data) => api.put(`/api/employers/${id}`, data),
    deleteEmployer: (id) => api.delete(`/api/employers/${id}`),

    // Login
    login: (firstName, email) => api.post('/api/login', { firstName, email }),

    // Invoice Projects
    getInvoiceProjects: () => api.get('/api/invoice-projects'),

    // Sections
    getSections: () => api.get('/api/sections'),

    // Jira Projects
    getJiraProjects: () => api.get('/api/jira-projects'),
    createJiraProject: (data) => api.post('/api/jira-projects', data),
    updateJiraProject: (id, data) => api.put(`/api/jira-projects/${id}`, data),
    deleteJiraProject: (id) => api.delete(`/api/jira-projects/${id}`),
    exportJiraProjectsUrl: () => '/api/jira-projects/export',
    importJiraProjects: (data) => api.post('/api/jira-projects/import', data),

    // Time Entries
    getTimeEntries: (consultantId, year, month) =>
        api.get(`/api/time-entries?consultantId=${consultantId}&year=${year}&month=${month}`),
    upsertTimeEntry: (data) => api.put('/api/time-entries', data),
    deleteTimeEntry: (id) => api.delete(`/api/time-entries/${id}`),
    deleteTimeEntriesByIssue: (consultantId, jiraIssueKey, year, month) =>
        api.delete(`/api/time-entries/by-issue?consultantId=${consultantId}&jiraIssueKey=${encodeURIComponent(jiraIssueKey)}&year=${year}&month=${month}`),
    exportTimeEntriesUrl: (consultantId, year, month) =>
        `/api/time-entries/export?consultantId=${consultantId}&year=${year}&month=${month}`,
    importTimeEntries: (data) => api.post('/api/time-entries/import', data),

    // Monthly locks
    getMonthlyLock: (consultantId, year, month) =>
        api.get(`/api/monthly-locks?consultantId=${consultantId}&year=${year}&month=${month}`),
    setMonthlyLock: (consultantId, year, month, locked) =>
        api.put('/api/monthly-locks', { consultantId, year, month, locked }),
    getMonthlyLocksByMonth: (year, month) =>
        api.get(`/api/monthly-locks/by-month?year=${year}&month=${month}`),

    // Holidays
    getHolidays: (year) => api.get(`/api/holidays?year=${year}`),

    // Monthly summary
    getMonthlySummary: (year, month) => api.get(`/api/monthly-summary?year=${year}&month=${month}`),

    // Reports
    getMonthlyReport: (year, month) => api.get(`/api/reports/monthly?year=${year}&month=${month}`),
    getMonthlyReportExcelUrl: (year, month, invoiceProjectId, employerId) =>
        `/api/reports/monthly/excel?year=${year}&month=${month}&invoiceProjectId=${invoiceProjectId}${employerId ? '&employerId=' + employerId : ''}`,
    getMonthlyReportPdfUrl: (year, month, invoiceProjectId, employerId) =>
        `/api/reports/monthly/pdf?year=${year}&month=${month}&invoiceProjectId=${invoiceProjectId}${employerId ? '&employerId=' + employerId : ''}`
};

export default api;
