/**
 * Rung 3 of the review ladder (docs/superpowers/specs/2026-11-15-production-ladder-design.md):
 * the sentence is replayed in the placement game with its articles blanked ("___") until the
 * phrase they belong to is placed. Pure (no DOM), unit-tested in tests/articleBlank.test.js.
 * Contractions ("im", "zum") and possessives ("mein") are not articles and stay visible.
 */

import { bare, phraseContinuation } from './felderLesson.js';

export const ARTICLES = new Set(['der', 'die', 'das', 'den', 'dem', 'des',
    'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
    'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines']);

/**
 * Indices of the articles: an article form (by its text) that continues into a noun of its own
 * phrase (same case and gender, directly or after up to two adjectives; see phraseContinuation),
 * so a lone pronoun ("Die ist neu.") is not an article.
 * @param {Word[]} words
 * @returns {number[]}
 */
export function articleIndexes(words) {
    const result = [];
    words.forEach((w, i) => {
        if (ARTICLES.has(bare(w.text).toLowerCase()) && phraseContinuation(words, i) >= 0) result.push(i);
    });
    return result;
}

/**
 * Word texts with every article at an index >= fromIndex replaced by "___"
 * (punctuation around the word is kept: "„Die" → "„___").
 * @param {Word[]} words
 * @param {number} fromIndex
 * @returns {string[]}
 */
export function blankArticles(words, fromIndex) {
    const blank = new Set(articleIndexes(words).filter(i => i >= fromIndex));
    return words.map((w, i) => {
        if (!blank.has(i)) return w.text;
        const core = bare(w.text);
        const start = w.text.indexOf(core);
        return `${w.text.slice(0, start)}___${w.text.slice(start + core.length)}`;
    });
}

/** Rung 3 eligibility: the sentence has at least one article to blank. */
export const hasArticle = words => articleIndexes(words).length > 0;
