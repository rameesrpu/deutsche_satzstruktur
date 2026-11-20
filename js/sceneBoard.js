// sceneBoard: the preposition-scene board kind (Wo? Wohin?). A hen walks to a place (Wohin? Akkusativ)
// or sits at one (Wo? Dativ). This file is the pure part: sentences, article blank, preposition options.

import { parseNoun } from './hotspotBoard.js';
import { articleFor } from './gameRules.js';

export const PREPS = ['in', 'an', 'auf', 'unter', 'über', 'vor', 'hinter', 'neben', 'zwischen'];

const GENDER_KEY = { masc: 'm', fem: 'f', neut: 'n', pl: 'pl' };
const CONTRACTED = { 'in dem': 'im', 'in das': 'ins', 'an dem': 'am', 'an das': 'ans' };
const CASE = { wohin: 'akk', wo: 'dat' };

const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "wohin"/"wo" ids: `<item id>.wohin`. Every item has a Wohin? id; a Wo? id only with a `wo` verb. */
export function sceneItemIds(set) {
    return set.items.flatMap(it => [`${it.id}.wohin`, ...(it.verbs.wo ? [`${it.id}.wo`] : [])]);
}

/** Dative plural adds -n unless the noun ends in -n or -s. */
function nounForm(n, caseName) {
    if (n.gender === 'pl') {
        const pl = n.plural || n.noun;
        return caseName === 'dat' && !/[ns]$/.test(pl) ? pl + 'n' : pl;
    }
    return n.noun;
}

function parts(set, itemId) {
    const [id, kind] = itemId.split('.');
    const item = set.items.find(i => i.id === id);
    if (!item || !CASE[kind] || (kind === 'wo' && !item.verbs.wo)) throw new Error(`sceneSentence: no such item ${itemId}`);
    return { item, kind, caseName: CASE[kind] };
}

/** One landmark in a case: its article and noun. */
function landmarkIn(set, key, caseName) {
    const n = parseNoun(set.landmarks[key].de);
    return { article: articleFor(GENDER_KEY[n.gender], caseName), noun: nounForm(n, caseName) };
}

/** The article slot (preposition included when either case contracts) and the words after it, for one case. */
function slot(set, item, caseName) {
    const a = landmarkIn(set, item.landmark, caseName);
    if (item.landmark2) {
        const b = landmarkIn(set, item.landmark2, caseName);
        return { prepInSlot: false, slot: `${a.article} … ${b.article}`, a, b };
    }
    const contracts = ['akk', 'dat'].some(c => CONTRACTED[`${item.prep} ${landmarkIn(set, item.landmark, c).article}`]);
    const word = contracts
        ? (CONTRACTED[`${item.prep} ${a.article}`] || `${item.prep} ${a.article}`)
        : a.article;
    return { prepInSlot: contracts, slot: word, a };
}

/**
 * @param {Object} set
 * @param {string} itemId  `<item id>.wohin` or `.wo`
 */
export function sceneSentence(set, itemId) {
    const { item, kind, caseName } = parts(set, itemId);
    const other = caseName === 'akk' ? 'dat' : 'akk';
    const mine = slot(set, item, caseName);
    const theirs = slot(set, item, other);
    const verb = item.verbs[kind];
    let phrase;
    if (item.landmark2) {
        phrase = `${item.prep} ${mine.a.article} ${mine.a.noun} und ${mine.b.article} ${mine.b.noun}`;
    } else if (mine.prepInSlot) {
        phrase = `${mine.slot} ${mine.a.noun}`;
    } else {
        phrase = `${item.prep} ${mine.a.article} ${mine.a.noun}`;
    }
    const mover = parseNoun(set.mover.de);
    return {
        kind, case: caseName,
        text: `${capital(`${mover.article} ${mover.noun}`)} ${verb} ${phrase}.`,
        verb, prep: item.prep, phrase,
        answer: mine.slot, other: theirs.slot,
    };
}

/**
 * The sentence with its article slot cut out. `options`: Akkusativ form first, Dativ second.
 * Contracted (either case): the slot is the whole word(s) "ins" / "an den", so `before` has no preposition.
 * Two landmarks: `after` is the template `{1} Baum und {2} Bank.` and each option carries both articles.
 */
export function articleBlank(set, itemId) {
    const { item, kind, caseName } = parts(set, itemId);
    const s = sceneSentence(set, itemId);
    const akk = slot(set, item, 'akk');
    const dat = slot(set, item, 'dat');
    const mover = parseNoun(set.mover.de);
    const head = `${capital(`${mover.article} ${mover.noun}`)} ${s.verb} `;
    const options = [akk.slot, dat.slot];
    const answer = caseName === 'akk' ? akk.slot : dat.slot;
    if (item.landmark2) {
        return { before: `${head}${item.prep} `, after: `{1} ${akk.a.noun} und {2} ${akk.b.noun}.`, options, answer };
    }
    return {
        before: akk.prepInSlot ? head : `${head}${item.prep} `,
        after: ` ${akk.a.noun}.`, options, answer,
    };
}

/** Four of PREPS including the item's, shuffled. */
export function prepOptions(itemId, rng = Math.random) {
    const key = itemId.split('.')[0].split('-')[0];
    const prep = key === 'ueber' ? 'über' : key;
    const pool = PREPS.filter(p => p !== prep);
    const picked = [prep];
    while (picked.length < 4) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    for (let i = picked.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked;
}

export const ruleHint = kind => (kind === 'wohin' ? 'Wohin? → Akkusativ' : 'Wo? → Dativ');

/** The kind's practice ids for the scored modes. */
export const itemIds = set => sceneItemIds(set);
