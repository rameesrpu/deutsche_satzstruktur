// Boards: the pure five-box schedule of picture practice (no DOM, no storage).
// A board item (id) has an entry {box, due, seen, correct, lastSeen}; right → next box, wrong → box 0.

import { startOfDay, addDays } from './ladder.js';

/** Days until the next review, per box 0..4. */
export const BOX_DAYS = [1, 3, 7, 14, 30];
export const SESSION_SIZE = 10;
export const NEW_PER_SESSION = 5;
const TOP_BOX = BOX_DAYS.length - 1;

/** @param {?import('./types.js').BoardEntry} entry */
export function afterAnswer(entry, ok, now) {
    const e = entry || { box: 0, due: 0, seen: 0, correct: 0, lastSeen: 0 };
    const box = ok ? Math.min(e.box + 1, TOP_BOX) : 0;
    return {
        box,
        due: addDays(startOfDay(now), BOX_DAYS[box]),
        seen: e.seen + 1,
        correct: e.correct + (ok ? 1 : 0),
        lastSeen: now,
    };
}

/** Ids for one session: due entries (oldest due first), then new ids (in `ids` order) up to `newMax`, cut to `size`. */
export function pickSession(ids, get, now, { size = SESSION_SIZE, newMax = NEW_PER_SESSION } = {}) {
    const due = [];
    const fresh = [];
    ids.forEach((id, i) => {
        const e = get(id);
        if (!e) fresh.push(id);
        else if (e.due <= now) due.push({ id, due: e.due, i });
    });
    due.sort((a, b) => a.due - b.due || a.i - b.i);
    return [...due.map(d => d.id), ...fresh.slice(0, newMax)].slice(0, size);
}

/** pickSession options: "Wiederholen" (review) practises only what is due, no new items. */
export const sessionOptions = review => (review ? { size: SESSION_SIZE, newMax: 0 } : {});

/** Counts over the ids of a set; entries for ids not in `ids` are ignored. */
export function setProgress(ids, get, now) {
    let learned = 0;
    let due = 0;
    for (const id of ids) {
        const e = get(id);
        if (!e) continue;
        if (e.box >= 1) learned++;
        if (e.due <= now) due++;
    }
    return { total: ids.length, learned, due };
}
