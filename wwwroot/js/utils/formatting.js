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

/**
 * Adjusts distributed values using the largest remainder method so that
 * the sum of 2-decimal-rounded values equals the rounded total.
 * Prevents rounding errors when distributing hours across projects/sections.
 * @param {Object} rawValues - Map of id → raw decimal value
 * @returns {Object} Map of id → adjusted value (rounded to 2 decimals, sum preserved)
 */
export function distributeWithRounding(rawValues) {
    const ids = Object.keys(rawValues);
    if (ids.length === 0) return {};

    const totalRaw = ids.reduce((sum, id) => sum + rawValues[id], 0);
    const totalTarget = Math.round(totalRaw * 100);

    const items = ids
        .filter(id => rawValues[id] > 0)
        .map(id => {
            const cents = rawValues[id] * 100;
            const floored = Math.floor(cents);
            return { id, floored, remainder: cents - floored };
        });

    const flooredSum = items.reduce((sum, item) => sum + item.floored, 0);
    let extra = totalTarget - flooredSum;

    items.sort((a, b) => b.remainder - a.remainder);

    const result = {};
    for (const item of items) {
        result[item.id] = (item.floored + (extra > 0 ? 1 : 0)) / 100;
        if (extra > 0) extra--;
    }

    // Include zero-value keys
    for (const id of ids) {
        if (!(id in result)) result[id] = 0;
    }

    return result;
}
