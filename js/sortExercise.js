/**
 * Generic "sort chips into labelled zones" exercise (Klinik: Anamnese questions, Arztbrief
 * sentences). Pure logic (no DOM), unit-tested in tests/sortExercise.test.js; sortScreen.js draws it.
 * A chip may be accepted by several zones (`zones`); after MAX_WRONG_ATTEMPTS wrong drops it is
 * placed in its first accepted zone.
 */

import { MAX_WRONG_ATTEMPTS } from './gameRules.js';

/** @typedef {{id: string, text: string, zones: string[], en: ?string}} SortChip */
/** @typedef {{title: string, zones: {id: string, title: string}[], chips: SortChip[]}} SortModel */
/** @typedef {{model: SortModel, placed: Object<string, string>, attempts: Object<string, number>,
 *            mistakes: number, tray: string[]}} SortState */

/** Fisher-Yates shuffle of a copy. */
function shuffled(ids, rng) {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * @param {SortModel} model
 * @param {() => number} [rng]
 * @returns {SortState}
 */
export function createSort(model, rng = Math.random) {
    return { model, placed: {}, attempts: {}, mistakes: 0, tray: shuffled(model.chips.map(c => c.id), rng) };
}

/**
 * Drop a chip on a zone. Returns a new state; the input state is not changed.
 * @param {SortState} state
 * @param {string} chipId
 * @param {string} zoneId
 * @returns {{state: SortState, ok: boolean, auto: boolean}}
 */
export function dropOnZone(state, chipId, zoneId) {
    const chip = state.model.chips.find(c => c.id === chipId);
    if (!chip || state.placed[chipId] !== undefined || !state.model.zones.some(z => z.id === zoneId)) {
        return { state, ok: false, auto: false };
    }
    const place = (zone, extra) => ({ ...state, ...extra, placed: { ...state.placed, [chipId]: zone },
        tray: state.tray.filter(t => t !== chipId) });
    if (chip.zones.includes(zoneId)) return { state: place(zoneId, {}), ok: true, auto: false };

    const tries = (state.attempts[chipId] || 0) + 1;
    const next = { attempts: { ...state.attempts, [chipId]: tries }, mistakes: state.mistakes + 1 };
    if (tries >= MAX_WRONG_ATTEMPTS) return { state: place(chip.zones[0], next), ok: false, auto: true };
    return { state: { ...state, ...next }, ok: false, auto: false };
}

/** @param {SortState} state */
export const sortSolved = state => state.model.chips.every(c => state.placed[c.id] !== undefined);

/** The chips placed in a zone, in placing order. */
export const zoneChips = (state, zoneId) =>
    Object.keys(state.placed).filter(id => state.placed[id] === zoneId)
        .map(id => state.model.chips.find(c => c.id === id));
