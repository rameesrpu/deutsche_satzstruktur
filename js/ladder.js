// Production ladder: the pure review schedule. A sentence enters the ladder after its first play
// (rung 2) and is reviewed on growing intervals; a mistake drops it one rung. Rung 3 is the top.
// No DOM, no storage: progressStore.js keeps the entries, this file only computes them.

export const RUNG_FIRST = 2;
export const RUNG_TOP = 3;
/** Days until the next review after reaching a rung (by rung reached). */
export const PASS_DAYS = { 2: 1, 3: 3, 4: 7, 5: 14 };
/** Days after a pass at the top: the first one, then every later one. */
export const TOP_DAYS = [14, 30];
/** Existing sentences join the ladder this many per day. */
export const MIGRATION_PER_DAY = 10;

/** Local midnight before `now` (ms). */
export function startOfDay(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** Local midnight `n` days after the local midnight `dayStart` (DST-safe). */
export function addDays(dayStart, n) {
    const d = new Date(dayStart);
    d.setDate(d.getDate() + n);
    return d.getTime();
}

/**
 * Ladder state for a sentence on its first play; an entry already on the ladder is unchanged.
 * @param {?object} entry
 * @param {number} now
 * @param {{2: boolean, 3: boolean}} eligible  which rungs this sentence can be tested on
 * @returns {{rung: number, due: number, topPasses: number}}
 */
export function enterLadder(entry, now, eligible) {
    if (entry && Number.isFinite(entry.rung)) return { rung: entry.rung, due: entry.due, topPasses: entry.topPasses };
    if (!eligible[2] && !eligible[3]) return { rung: 0, due: 0, topPasses: 0 };
    return { rung: RUNG_FIRST, due: addDays(startOfDay(now), 1), topPasses: 0 };
}

/** The rung actually shown: smallest eligible rung >= `rung`, else the largest eligible one, else null. */
export function exerciseRung(rung, eligible) {
    for (let r = Math.max(rung, RUNG_FIRST); r <= RUNG_TOP; r++) if (eligible[r]) return r;
    for (let r = RUNG_TOP; r >= RUNG_FIRST; r--) if (eligible[r]) return r;
    return null;
}

/**
 * New ladder state after a review, measured from the rung that was actually shown.
 * @returns {{rung: number, due: number, topPasses: number}}
 */
export function afterReview(entry, ok, now, eligible) {
    const today = startOfDay(now);
    const shown = exerciseRung(entry.rung, eligible);
    if (shown === null) return { rung: entry.rung, due: entry.due, topPasses: entry.topPasses };
    if (ok) {
        for (let r = shown + 1; r <= RUNG_TOP; r++) {
            if (eligible[r]) return { rung: r, due: addDays(today, PASS_DAYS[r]), topPasses: 0 };
        }
        const passes = entry.topPasses || 0;
        return { rung: shown, due: addDays(today, TOP_DAYS[Math.min(passes, 1)]), topPasses: passes + 1 };
    }
    let lower = shown;
    for (let r = shown - 1; r >= RUNG_FIRST; r--) if (eligible[r]) { lower = r; break; }
    return { rung: lower, due: addDays(today, 1), topPasses: 0 };
}

/** Keys due for review, oldest due first, cut to the daily cap minus reviews already done today. */
export function dueKeys(sentences, now, cap) {
    const today = startOfDay(now);
    const all = Object.entries(sentences);
    const reviewedToday = all.filter(([, e]) => e.lastReview >= today).length;
    return all
        .filter(([, e]) => e.rung >= RUNG_FIRST && e.due <= now)
        .sort((a, b) => a[1].due - b[1].due || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([key]) => key)
        .slice(0, Math.max(0, cap - reviewedToday));
}

function mistakeCount(entry) {
    const m = entry.mistakes;
    if (!m) return 0;
    return (m.cell || 0) + Object.values(m.case || {}).reduce((a, b) => a + b, 0);
}

/**
 * Put existing sentences on the ladder, `perDay` per day, mistakes first. Mutates `sentences`;
 * entries that already have a rung are untouched; custom and never-played ones get rung 0.
 */
export function migrate(sentences, now, perDay = MIGRATION_PER_DAY) {
    const today = startOfDay(now);
    const queue = [];
    for (const [key, e] of Object.entries(sentences)) {
        if (Number.isFinite(e.rung)) continue;
        if (key.startsWith('custom/') || e.plays === 0) e.rung = 0;
        else queue.push([key, e]);
    }
    queue.sort((a, b) => (mistakeCount(b[1]) > 0) - (mistakeCount(a[1]) > 0)
        || (a[1].lastPlayed || 0) - (b[1].lastPlayed || 0)
        || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    queue.forEach(([, e], i) => {
        e.rung = RUNG_FIRST;
        e.due = addDays(today, Math.floor(i / perDay));
        e.topPasses = 0;
        e.lastReview = 0;
    });
}
