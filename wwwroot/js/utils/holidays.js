import api from '../services/api.js';

const cache = new Map();

async function getHolidaysForYear(year) {
    if (cache.has(year)) return cache.get(year);
    try {
        const holidays = await api.getHolidays(year);
        cache.set(year, holidays);
        return holidays;
    } catch {
        return [];
    }
}

export async function fetchHolidaysForMonth(year, month) {
    const otherYear = month <= 6 ? year - 1 : year + 1;
    const [a, b] = await Promise.all([
        getHolidaysForYear(year),
        getHolidaysForYear(otherYear)
    ]);
    return [...a, ...b];
}
