// Story glossary: which words of a text have a meaning, and the tap-to-translate
// popover. Chapter files carry `glossary` ({headword: GlossaryEntry}), built from
// the story sources by scripts/build_stories.py (format: data/stories/CURRICULUM.md).
// glossTokens() is pure and mirrors glossary_matches() in build_stories.py; keep
// the two in sync.

import { gameSounds } from './sound.js';

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} de       dictionary form, e.g. "das Gepäckband, -bänder", "auf|gehen"
 * @property {string} en       short English meaning
 * @property {string[]} forms  forms as they appear in the text; "geht … auf" = separable verb
 */

/**
 * @typedef {Object} GlossToken
 * @property {string} text
 * @property {?string} [key]            glossary headword (words with an entry only)
 * @property {?GlossaryEntry} [entry]
 */

const WORD_RE = /\p{L}+(?:-\p{L}+)*/gu;
const SENTENCE_END_RE = /[.!?:;]/;
// A separable particle closes its clause: punctuation, end of text, or "… aus wie"
const PARTICLE_END_RE = /^\s*(?:[.,!?;:…“”"»«)]|$|wie(?!\p{L}))/u;
const SEPARATOR = '…';

/** A token matches a form exactly, or (sentence start) with its first letter lowercased. */
function formVariants(token) {
    const first = token[0];
    return first !== first.toLowerCase() ? [token, first.toLowerCase() + token.slice(1)] : [token];
}

/**
 * Split `text` into pieces (words and the text between them) and attach the
 * glossary entry to each word that has one. Separable forms ("geht … auf")
 * match when the particle comes later in the same sentence and closes the
 * clause; they win over single forms.
 * @param {string} text
 * @param {Object<string, GlossaryEntry>} [glossary]
 * @returns {GlossToken[]}  pieces in order; joined `text`s give back `text`
 */
export function glossTokens(text, glossary = {}) {
    const words = Array.from(text.matchAll(WORD_RE), m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
    const found = new Array(words.length).fill(null);
    const singles = new Map();
    const separables = [];
    for (const [key, entry] of Object.entries(glossary)) {
        for (const form of entry.forms) {
            if (form.includes(SEPARATOR)) {
                const [first, particle] = form.split(SEPARATOR).map(p => p.trim());
                separables.push({ first, particle, key });
            } else {
                singles.set(form, key);
            }
        }
    }

    words.forEach((word, i) => {
        if (found[i]) return;
        const variants = formVariants(word.text);
        for (const { first, particle, key } of separables) {
            if (!variants.includes(first)) continue;
            for (let j = i + 1; j < words.length; j++) {
                if (SENTENCE_END_RE.test(text.slice(words[j - 1].end, words[j].start))) break;
                if (words[j].text === particle && !found[j] && PARTICLE_END_RE.test(text.slice(words[j].end))) {
                    found[i] = found[j] = key;
                    break;
                }
            }
            if (found[i]) break;
        }
    });
    words.forEach((word, i) => {
        if (found[i]) return;
        const variant = formVariants(word.text).find(v => singles.has(v));
        if (variant) found[i] = singles.get(variant);
    });

    const pieces = [];
    let pos = 0;
    words.forEach((word, i) => {
        if (word.start > pos) pieces.push({ text: text.slice(pos, word.start) });
        pieces.push(found[i] ? { text: word.text, key: found[i], entry: glossary[found[i]] } : { text: word.text });
        pos = word.end;
    });
    if (pos < text.length) pieces.push({ text: text.slice(pos) });
    return pieces;
}

/**
 * What to read aloud for an entry: the dictionary form without plural ending,
 * notes or the separable marker ("das Gepäckband, -bänder" → "das Gepäckband",
 * "aus|sehen (sieht aus)" → "aussehen").
 * @param {string} de
 * @returns {string}
 */
export function speakableForm(de) {
    return de.split(/[,;/+]/)[0].replace(/\([^)]*\)/g, '').replace(/\|/g, '').trim();
}

// ---------------------------------------------------------------------------
// DOM: glossed text and the word popover
// ---------------------------------------------------------------------------

const POPOVER_ID = 'gloss-popover';
const MARGIN = 8; // min distance to the screen edge (px)

/**
 * Fill `el` with `text`; words with a glossary entry become tappable.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {Object<string, GlossaryEntry>} [glossary]
 * @param {?function(HTMLElement, GlossaryEntry): void} [onWord]  tap handler
 *        (default: the word popover; the story reader shows a bottom bar instead)
 */
export function renderGlossedText(el, text, glossary, onWord = null) {
    el.textContent = '';
    if (!glossary) {
        el.textContent = text;
        return;
    }
    for (const piece of glossTokens(text, glossary)) {
        if (!piece.entry) {
            el.appendChild(document.createTextNode(piece.text));
            continue;
        }
        const word = document.createElement('span');
        word.className = 'gloss-word';
        word.textContent = piece.text;
        word.tabIndex = 0;
        word.setAttribute('role', 'button');
        word.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onWord) onWord(word, piece.entry);
            else toggleGlossPopover(word, piece.entry);
        });
        el.appendChild(word);
    }
}

export function closeGlossPopover() {
    const pop = document.getElementById(POPOVER_ID);
    if (!pop) return;
    document.removeEventListener('pointerdown', pop._onOutside, true);
    document.removeEventListener('scroll', pop._onScroll, true);
    window.removeEventListener('resize', pop._onScroll);
    if (pop._anchor) pop._anchor.classList.remove('gloss-word-active');
    pop.remove();
}

/**
 * Open the meaning popover under (or above) `anchor`; tapping the same word
 * again, anywhere outside, or scrolling closes it.
 * @param {HTMLElement} anchor
 * @param {GlossaryEntry} entry
 */
export function toggleGlossPopover(anchor, entry) {
    const open = document.getElementById(POPOVER_ID);
    const sameWord = open && open._anchor === anchor;
    closeGlossPopover();
    if (sameWord) return;

    const pop = document.createElement('div');
    pop.id = POPOVER_ID;
    pop.className = 'gloss-popover';
    pop.setAttribute('role', 'dialog');
    pop._anchor = anchor;

    const de = document.createElement('div');
    de.className = 'gloss-de';
    de.textContent = entry.de;
    const en = document.createElement('div');
    en.className = 'gloss-en';
    en.textContent = entry.en;
    const text = document.createElement('div');
    text.className = 'gloss-text';
    text.append(de, en);
    pop.appendChild(text);

    if (gameSounds.speechAvailable && 'speechSynthesis' in window) {
        const speak = document.createElement('button');
        speak.type = 'button';
        speak.className = 'gloss-speak';
        speak.title = 'Aussprache';
        speak.textContent = '🔊';
        speak.addEventListener('click', () => gameSounds.speak(speakableForm(entry.de)));
        pop.appendChild(speak);
    }

    document.body.appendChild(pop);
    anchor.classList.add('gloss-word-active');
    placePopover(pop, anchor);

    pop._onOutside = (e) => {
        if (!pop.contains(e.target) && e.target !== anchor) closeGlossPopover();
    };
    pop._onScroll = () => closeGlossPopover();
    document.addEventListener('pointerdown', pop._onOutside, true);
    document.addEventListener('scroll', pop._onScroll, true);
    window.addEventListener('resize', pop._onScroll);
}

/** Below the word if it fits, else above; always inside the viewport. */
function placePopover(pop, anchor) {
    const a = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(a.left + a.width / 2 - w / 2, vw - w - MARGIN));
    let top = a.bottom + 6;
    if (top + h > vh - MARGIN) top = Math.max(MARGIN, a.top - h - 6);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
}
