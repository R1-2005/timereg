export const MONTH_NAMES = [
    'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_SHORT = [
    'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'des'
];

export function formatHours(hours, mode) {
    if (!hours || hours === 0) return '';
    if (mode === 'hhmm') {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    }
    return hours.toFixed(1).replace('.', ',');
}

export function formatDistribution(hours, mode) {
    if (!hours || hours === 0) return '';
    if (mode === 'hhmm') {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    }
    return hours.toFixed(2).replace('.', ',');
}
