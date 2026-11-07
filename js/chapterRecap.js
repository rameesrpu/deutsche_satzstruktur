// Chapter-end recap (U6, docs/redesign-plan.md): the full-screen 'end' screen after a story
// chapter on the play screen — stats, "Das war schwer" (the run's missed phrases), the
// chapter's new words as chips, "Weiter" and "schwere Sätze nochmal".
// GameMode records one ChapterRunSentence per finished sentence (see recordRun in
// gamemode.js); the pure helpers at the top turn a run into the screen model and are
// unit-tested in tests/chapterRecap.test.js. renderRecap() builds the DOM and calls back
// into the app for every action.

import { GRAMMAR_PALETTE } from './grammaticalConfig.js';
import { articleGender } from './homeScreen.js';
import { beatsAfterLast } from './storyNarration.js';
import { speakableForm } from './glossary.js';
import { gameSounds } from './sound.js';

/**
 * One wrong-placed phrase of a sentence (the first wrong attempt; `attempts` counts all).
 * @typedef {Object} RunMiss
 * @property {number} start, end     word indices of the phrase in `words`
 * @property {string} phrase
 * @property {string} key            GRAMMAR_PALETTE key of the correct cell ('fem', 'ich', …)
 * @property {boolean} cellWrong
 * @property {boolean} caseWrong
 * @property {?string} chosenCell    label of the tapped cell, e.g. 'PLURAL'
 * @property {?Case} chosenCase      case selected for that attempt (null = none)
 * @property {?string} expectedCell  label of the right cell, e.g. 'FEMININ'
 * @property {?Case} expectedCase    the right case (null = no case: verbs)
 * @property {string} why            German line on the right answer (placementFeedback, auto)
 * @property {number} attempts       wrong attempts on this phrase
 */

/**
 * @typedef {Object} ChapterRunSentence
 * @property {string} text
 * @property {string[]} words   word texts in sentence order
 * @property {number} items     placements the sentence needed (phrases to place)
 * @property {RunMiss[]} misses
 */

/** Chips shown before "+n weitere" (all words are on the Wörter screen). */
export const MAX_CHIPS = 18;
/** Hard sentences listed under "Das war schwer". */
export const MAX_HARD = 3;

const CASE_NAMES = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };
const PERSON_LABELS = new Set(['ICH', 'DU', 'WIR', 'IHR']);

// --- Pure helpers ---

/**
 * Stats tiles. % correct = phrases placed right on the first try / all phrases placed
 * (auto-placed phrases count as wrong); null when nothing had to be placed.
 * @param {ChapterRunSentence[]} results
 * @param {number} newWords
 * @returns {{sentences: number, placements: number, firstTry: number, percent: ?number, newWords: number}}
 */
export function recapStats(results, newWords) {
    let placements = 0, firstTry = 0;
    for (const r of results) {
        placements += r.items;
        firstTry += Math.max(0, r.items - r.misses.length);
    }
    return {
        sentences: results.length, placements, firstTry,
        percent: placements > 0 ? Math.round(100 * firstTry / placements) : null,
        newWords,
    };
}

/**
 * Sentences with mistakes, worst first (most wrong attempts, then most missed phrases,
 * then sentence order).
 * @param {ChapterRunSentence[]} results
 * @returns {ChapterRunSentence[]}
 */
export function hardSentences(results) {
    const attempts = r => r.misses.reduce((n, m) => n + m.attempts, 0);
    return results
        .map((r, i) => ({ r, i, a: attempts(r) }))
        .filter(x => x.r.misses.length > 0)
        .sort((x, y) => y.a - x.a || y.r.misses.length - x.r.misses.length || x.i - y.i)
        .map(x => x.r);
}

/**
 * The sentence split into parts; missed phrases carry their palette key (underlined).
 * @param {string[]} words
 * @param {RunMiss[]} misses
 * @returns {{text: string, key: ?string}[]}  joined with spaces they give the sentence
 */
export function underlineParts(words, misses) {
    const keyAt = new Array(words.length).fill(null);
    const startAt = new Set();
    for (const m of misses) {
        startAt.add(m.start);
        for (let i = m.start; i <= m.end && i < words.length; i++) keyAt[i] = m.key;
    }
    const parts = [];
    words.forEach((w, i) => {
        const last = parts[parts.length - 1];
        if (last && last.key === keyAt[i] && !(keyAt[i] && startAt.has(i))) last.text += ' ' + w;
        else parts.push({ text: w, key: keyAt[i] });
    });
    return parts;
}

/** 'PLURAL' → 'Plural', 'ICH' → 'ich'. */
function cellTitle(label) {
    if (!label) return '';
    return PERSON_LABELS.has(label) ? label.toLowerCase() : label.charAt(0) + label.slice(1).toLowerCase();
}

/**
 * Why a phrase was missed: what was chosen, what is right (only the wrong parts: cell
 * and/or case) and the right answer's explanation.
 * @param {RunMiss} miss
 * @returns {{chosen: string, answer: string, why: string}}
 *   shown as "Du hast <chosen> gewählt, richtig: <answer>. <why>"
 */
export function missReason(miss) {
    const cell = miss.cellWrong ? cellTitle(miss.chosenCell) : '';
    let chosen;
    if (miss.caseWrong && !miss.chosenCase) chosen = cell ? `${cell} ohne Fall` : 'keinen Fall';
    else chosen = [cell, miss.caseWrong ? CASE_NAMES[miss.chosenCase] : ''].filter(Boolean).join(' + ');
    const answer = [miss.cellWrong ? cellTitle(miss.expectedCell) : '',
        miss.caseWrong ? CASE_NAMES[miss.expectedCase] || '' : ''].filter(Boolean).join(' + ');
    return { chosen, answer, why: miss.why || '' };
}

/** The missed phrase with the most wrong attempts (first one on a tie). */
function worstMiss(misses) {
    return misses.reduce((a, b) => (b.attempts > a.attempts ? b : a));
}

/**
 * Chip for a glossary entry: the headword without plural/notes ("das Flugzeug, -e" →
 * "das Flugzeug", "werden (wird)" → "werden", "auf|gehen" → "aufgehen") and its gender
 * from the article.
 * @param {import('./glossary.js').GlossaryEntry} entry
 * @returns {{label: string, gender: ?string, de: string, en: string}}
 */
export function wordChip(entry) {
    const de = entry.de || '';
    const label = (de.split(/,|;| \/ | \(/)[0].trim() || de).replace(/\|/g, '');
    return { label, gender: articleGender(de), de, en: entry.en || '' };
}

/**
 * Glossary entries of a chapter that no earlier chapter of its level had (by headword).
 * @param {Object<string, Object>} glossary
 * @param {Object<string, Object>[]} earlier
 * @returns {Object[]} entries in glossary order
 */
export function newGlossaryEntries(glossary, earlier = []) {
    const seen = new Set(earlier.flatMap(g => Object.keys(g || {})));
    return Object.entries(glossary || {}).filter(([k]) => !seen.has(k)).map(([, e]) => e);
}

/**
 * Chips to show: nouns first (they carry the gender color), then the other words,
 * each group in glossary order; at most `max`.
 * @returns {{chips: Object[], more: number}}
 */
export function chipList(entries, max = MAX_CHIPS) {
    const chips = entries.map(wordChip);
    const sorted = [...chips.filter(c => c.gender), ...chips.filter(c => !c.gender)];
    return { chips: sorted.slice(0, max), more: Math.max(0, sorted.length - max) };
}

/**
 * Recap title: the last sentence of the chapter's closing narration if it is short,
 * else the chapter title.
 * @param {{title?: string, beats?: Object[]}} data
 * @param {string} fallback
 */
export function recapTitle(data, fallback = '') {
    const closing = beatsAfterLast((data && data.beats) || []).filter(b => b.read && !b.speaker);
    if (closing.length > 0) {
        const text = closing[closing.length - 1].read.trim();
        const sentences = text.match(/[^.!?…]+[.!?…]+/g) || [text];
        const last = sentences[sentences.length - 1].trim();
        if (last.length >= 8 && last.length <= 60 && !last.endsWith('?')) return last;
    }
    return (data && data.title) || fallback;
}

/**
 * Everything the recap screen shows.
 * @param {Object} p
 * @param {{id: string, label: string, data: Object}} p.chapter
 * @param {ChapterRunSentence[]} p.results
 * @param {boolean} p.complete       every sentence of the chapter played
 * @param {boolean} [p.replay]       the run was "schwere Sätze nochmal"
 * @param {Object[]} [p.earlierGlossaries]  glossaries of the level's earlier chapters
 * @param {?{id: string, label: string, unlocked: boolean}} [p.next]
 */
export function buildRecapModel({ chapter, results, complete, replay = false, earlierGlossaries = [], next = null }) {
    const data = chapter.data || {};
    const entries = newGlossaryEntries(data.glossary, earlierGlossaries);
    const hard = hardSentences(results);
    const { chips, more } = chipList(entries);
    return {
        kicker: replay ? `Kapitel ${chapter.id} · Wiederholung`
            : complete ? `Kapitel ${chapter.id} geschafft` : `Ende von Kapitel ${chapter.id}`,
        title: recapTitle(data, chapter.label),
        stats: recapStats(results, entries.length),
        hard: hard.slice(0, MAX_HARD).map(r => ({
            text: r.text,
            parts: underlineParts(r.words, r.misses),
            reason: missReason(worstMiss(r.misses)),
        })),
        hardTexts: hard.map(r => r.text),
        chips, moreWords: more,
        next,
        lockedHint: next && !next.unlocked && !replay
            ? `Spiel alle Sätze, dann öffnet sich Kapitel ${next.id}.` : null,
    };
}

// --- DOM ---

const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    review: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    speaker: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
};

function icon(name, size = 20, width = 2) {
    return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
        `stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ` +
        `aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Element helper: el('div', {className, onclick, ...}, child, 'text', …). */
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (k === 'html') node.innerHTML = v; // static icon markup only
        else if (k in node) node[k] = v;
        else node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
}

function speechUsable() {
    return gameSounds.speechAvailable && gameSounds.speechEnabled && 'speechSynthesis' in window;
}

/**
 * Render the recap into `root`.
 * @param {HTMLElement} root
 * @param {ReturnType<typeof buildRecapModel>} model
 * @param {{next: function(), home: function(), replay: function(string[]), words: function()}} actions
 */
export function renderRecap(root, model, actions) {
    const { stats } = model;
    const head = el('header', { className: 'recap-head' },
        el('span', { className: 'recap-badge', html: icon('check', 30, 2.4) }),
        el('span', { className: 'recap-kicker' }, model.kicker),
        el('h1', { className: 'recap-title', lang: 'de' }, model.title));

    const tile = (value, label) => el('div', { className: 'recap-tile' },
        el('strong', {}, value), el('span', {}, label));
    const tiles = el('div', { className: 'recap-tiles' },
        tile(String(stats.sentences), stats.sentences === 1 ? 'Satz' : 'Sätze'),
        tile(stats.percent == null ? '–' : `${stats.percent} %`, 'richtig'),
        tile(`+${stats.newWords}`, 'Wörter'));
    tiles.title = `Richtig = beim ersten Versuch richtig gelegt (${stats.firstTry} von ${stats.placements})`;

    const hardSection = el('section', { className: 'recap-section' },
        el('h2', { className: 'recap-h2' }, 'Das war schwer'));
    if (model.hard.length === 0) {
        hardSection.append(el('div', { className: 'recap-card recap-none' },
            el('span', { className: 'recap-none-icon', html: icon('smile', 22) }),
            el('span', {}, 'Nichts! Jeder Satz war beim ersten Versuch richtig.')));
    }
    for (const h of model.hard) {
        const sentence = el('p', { className: 'recap-sentence', lang: 'de' });
        h.parts.forEach((part, i) => {
            if (i > 0) sentence.append(' ');
            if (!part.key) { sentence.append(part.text); return; }
            const pal = GRAMMAR_PALETTE[part.key] || GRAMMAR_PALETTE.none;
            const mark = el('span', { className: 'recap-missed' }, part.text);
            mark.style.color = pal.ink;
            mark.style.borderBottomColor = pal.c;
            sentence.append(mark);
        });
        const reason = el('p', { className: 'recap-reason' });
        const { chosen, answer, why } = h.reason;
        if (chosen) {
            reason.append('Du hast ', el('b', {}, chosen), ' gewählt');
            if (answer) reason.append(', richtig: ', el('b', {}, answer));
            reason.append('. ');
        }
        reason.append(why);
        hardSection.append(el('div', { className: 'recap-card recap-hard' }, sentence, reason));
    }

    // Word chips; a tap shows the meaning in the ink bar (as in the reader)
    const wordBar = el('div', { className: 'story-reader-word recap-word', role: 'status', hidden: true });
    let activeChip = null;
    const closeWord = () => {
        if (activeChip) activeChip.setAttribute('aria-pressed', 'false');
        activeChip = null;
        wordBar.hidden = true;
        wordBar.replaceChildren();
    };
    const showWord = (chipEl, chip) => {
        if (activeChip === chipEl) { closeWord(); return; }
        closeWord();
        activeChip = chipEl;
        chipEl.setAttribute('aria-pressed', 'true');
        wordBar.append(el('div', { className: 'story-reader-word-text' },
            el('span', { className: 'story-reader-word-de', lang: 'de' }, chip.de),
            el('span', { className: 'story-reader-word-en', lang: 'en' }, chip.en)));
        if (speechUsable()) {
            wordBar.append(el('button', { type: 'button', className: 'story-reader-word-say',
                'aria-label': 'Aussprechen', html: icon('speaker', 20),
                onclick: () => gameSounds.speak(speakableForm(chip.de)) }));
        }
        wordBar.append(el('button', { type: 'button', className: 'story-reader-word-close',
            'aria-label': 'Schließen', html: icon('close', 20), onclick: closeWord }));
        wordBar.hidden = false;
    };

    const chips = el('div', { className: 'recap-chips' });
    for (const chip of model.chips) {
        const b = el('button', { type: 'button', className: 'recap-chip', lang: 'de', 'aria-pressed': 'false',
            onclick: () => showWord(b, chip) }, chip.label);
        if (chip.gender) {
            b.style.background = GRAMMAR_PALETTE[chip.gender].tint;
            b.style.color = GRAMMAR_PALETTE[chip.gender].ink;
        }
        chips.append(b);
    }
    if (model.moreWords > 0) {
        chips.append(el('button', { type: 'button', className: 'recap-chip recap-chip-more',
            onclick: () => actions.words() }, `+${model.moreWords} weitere`));
    }
    const wordsSection = model.chips.length === 0 ? null : el('section', { className: 'recap-section' },
        el('h2', { className: 'recap-h2' }, 'Neue Wörter'), chips);

    const next = model.next && model.next.unlocked ? model.next : null;
    const primary = el('button', { type: 'button', className: 'recap-btn recap-btn-primary',
        onclick: () => (next ? actions.next() : actions.home()) },
    next ? `Weiter: ${next.label}` : 'Zur Übersicht');
    primary.insertAdjacentHTML('beforeend', icon('arrow', 18, 2.2));
    const foot = el('div', { className: 'recap-foot' }, wordBar,
        model.lockedHint ? el('p', { className: 'recap-hint' }, model.lockedHint) : null,
        primary,
        model.hardTexts.length > 0 ? el('button', { type: 'button', className: 'recap-btn recap-btn-text',
            onclick: () => actions.replay(model.hardTexts), html: icon('review', 18) },
        `${model.hardTexts.length} ${model.hardTexts.length === 1 ? 'schweren Satz' : 'schwere Sätze'} nochmal`) : null);

    root.replaceChildren(el('div', { className: 'recap-inner' },
        el('div', { className: 'recap-body' }, head, tiles, hardSection, wordsSection), foot));
    root.scrollTop = 0;
}
