/**
 * Rung 2 "Ordnen": the learner drops shuffled phrase chips into the slots of the field model
 * (Vorfeld, Verb, Mittelfeld, Ende). Pure logic (no DOM), unit-tested in
 * tests/orderExercise.test.js; the screen is built on top of it.
 * The order inside the Mittelfeld is never tested (any order is correct German), so
 * `fieldChips` always shows a field's chips in sentence order.
 */

import { fieldZones } from './fieldZones.js';
import { bare } from './felderLesson.js';
import { MAX_WRONG_ATTEMPTS } from './gameRules.js';

/** @typedef {'vorfeld'|'verb'|'mittelfeld'|'ende'} Field */
/** @typedef {{id: number, text: string, field: Field, fixed: boolean}} OrderChip */
/** @typedef {{lead: string, fields: Field[], chips: OrderChip[], end: string}} OrderModel */
/** @typedef {{model: OrderModel, placed: Object<number, boolean>, attempts: Object<number, number>,
 *            mistakes: number, tray: number[]}} OrderState */

const MIN_MOVABLE = 3;
const isNoun = w => w.type === 'subject' || w.type === 'object';
const sameNoun = (a, b) => isNoun(a) && isNoun(b) && a.case === b.case && a.gender === b.gender;

const MAX_BETWEEN = 2; // words allowed between a preposition and its noun phrase

/**
 * Word index groups of the Mittelfeld: a preposition + its noun phrase, a noun run, or a single word.
 * Up to MAX_BETWEEN `other` words (numbers, adjectives, adverbs: "um sieben Uhr") may stand between the
 * preposition and the noun phrase. The library often tags the noun of such a phrase as `other` too
 * ("Uhr"): then the other words still join the preposition when the last one carries a non-nominative
 * case (the governed case), so "um sieben Uhr" is one chip but "in Ruhe heute" is not.
 */
function mittelfeldGroups(words, indices) {
    const groups = [];
    for (let k = 0; k < indices.length; k++) {
        const group = [indices[k]];
        let last = words[indices[k]];
        if (last.type === 'preposition') {
            let n = 0;
            while (n < MAX_BETWEEN && k + 1 + n < indices.length && words[indices[k + 1 + n]].type === 'other') n++;
            const next = k + 1 + n;
            if (next < indices.length && isNoun(words[indices[next]])) {
                while (k < next) { k++; group.push(indices[k]); }
                last = words[indices[k]];
            } else if (n > 0 && words[indices[k + n]].case && words[indices[k + n]].case !== 'nom') {
                while (n-- > 0) { k++; group.push(indices[k]); }
                last = words[indices[k]];
            }
        }
        if (isNoun(last)) {
            while (k + 1 < indices.length && sameNoun(last, words[indices[k + 1]])) {
                k++;
                group.push(indices[k]);
            }
        }
        groups.push(group);
    }
    return groups;
}

/**
 * @param {import('./types.js').Word[]} words
 * @returns {?OrderModel} null when the sentence is not a plain main clause or has fewer than
 *   3 movable chips (rung-2 eligibility)
 */
export function orderModel(words) {
    const zones = fieldZones(words);
    if (!zones) return null;
    const last = words[words.length - 1].text;
    const end = (last.match(/[.?!]+$/) || [''])[0];
    const textOf = idx => idx.map(i => {
        const t = words[i].text;
        return i === words.length - 1 ? t.slice(0, t.length - end.length) : t;
    }).join(' ');

    const chips = [];
    const add = (idx, field, fixed) => {
        if (idx.length) chips.push({ id: chips.length, text: textOf(idx), field, fixed });
    };
    add(zones.vorfeld, 'vorfeld', true);
    add(zones.verb, 'verb', false);
    for (const g of mittelfeldGroups(words, zones.mittelfeld)) add(g, 'mittelfeld', false);
    add(zones.ende, 'ende', false);
    if (chips.filter(c => !c.fixed).length < MIN_MOVABLE) return null;

    const fields = ['vorfeld', 'verb', 'mittelfeld'];
    if (zones.ende.length) fields.push('ende');
    return { lead: zones.lead.map(i => words[i].text).join(' '), fields, chips, end };
}

/** Shuffle (Fisher-Yates) that never returns the sentence order. */
function shuffled(ids, rng) {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.every((id, i) => id === ids[i])) a.push(a.shift());
    return a;
}

/**
 * @param {OrderModel} model
 * @param {() => number} [rng]
 * @returns {OrderState}
 */
export function createOrder(model, rng = Math.random) {
    const placed = {};
    for (const c of model.chips) if (c.fixed) placed[c.id] = true;
    const movable = model.chips.filter(c => !c.fixed).map(c => c.id);
    return { model, placed, attempts: {}, mistakes: 0, tray: shuffled(movable, rng) };
}

function hintFor(chip, field, model) {
    const verbHint = model.chips[0].field === 'vorfeld' ? 'Das Verb steht an Position 2.' : 'Das Verb steht am Anfang.';
    if (chip.field === 'verb' || field === 'verb') return verbHint;
    if (chip.field === 'ende') return 'Der zweite Verbteil steht am Ende.';
    if (field === 'ende') return 'Am Ende steht nur der zweite Verbteil.';
    return 'Das Vorfeld ist schon besetzt.';
}

/**
 * Drop a chip on a field. Returns a new state; the input state is not changed.
 * @param {OrderState} state
 * @param {number} id
 * @param {Field} field
 * @returns {{state: OrderState, ok: boolean, auto: boolean, hint: ?string}}
 */
export function dropChip(state, id, field) {
    const chip = state.model.chips[id];
    if (!chip || chip.fixed || state.placed[id]) return { state, ok: false, auto: false, hint: null };
    const place = extra => ({ ...state, ...extra, placed: { ...state.placed, [id]: true },
        tray: state.tray.filter(t => t !== id) });
    if (chip.field === field) return { state: place({}), ok: true, auto: false, hint: null };

    const tries = (state.attempts[id] || 0) + 1;
    const next = { ...state, attempts: { ...state.attempts, [id]: tries }, mistakes: state.mistakes + 1 };
    const hint = hintFor(chip, field, state.model);
    if (tries >= MAX_WRONG_ATTEMPTS) return { state: place(next), ok: false, auto: true, hint };
    return { state: next, ok: false, auto: false, hint };
}

/** @param {OrderState} state */
export const isSolved = state => state.model.chips.every(c => state.placed[c.id]);

/** The placed chips of a field in sentence order. */
export const fieldChips = (state, field) =>
    state.model.chips.filter(c => c.field === field && state.placed[c.id]);
