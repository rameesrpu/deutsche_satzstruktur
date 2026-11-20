/**
 * Rungs 4 and 5 of the review ladder (docs/superpowers/specs/2026-11-15-production-ladder-design.md):
 * comparing what the learner typed (Schreiben) or said (Sprechen) with the sentence.
 * Pure (no DOM), unit-tested in tests/textMatch.test.js.
 * Words are compared after `fold` (lower case, ae/oe/ue/ss, small digits as words);
 * typed text is aligned to the sentence word by word (weighted edit distance), not by set membership.
 */

export const SPEECH_PASS = 0.8;

const NUMBER_WORDS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
    'zehn', 'elf', 'zwölf'];
const EDGE_PUNCT = /^[\s.,!?;:„“"”‚‘’'()\[\]{}…«»–—-]+|[\s.,!?;:„“"”‚‘’'()\[\]{}…«»–—-]+$/g;

/** Words of a text without surrounding punctuation ("Dr." → "Dr"); inner hyphens stay. */
export function tokens(text) {
    if (typeof text !== 'string') return [];
    return text.split(/\s+/).map(t => t.replace(EDGE_PUNCT, '')).filter(Boolean);
}

/** Comparison form of one word: lower case, ä→ae ö→oe ü→ue ß→ss, digits 0–12 → German word. */
export function fold(word) {
    const w = String(word).toLowerCase();
    if (/^\d+$/.test(w) && Number(w) <= 12 && String(Number(w)) === w) return NUMBER_WORDS[Number(w)];
    return w.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

function levenshtein(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

const isUpper = w => w[0] !== w[0].toLowerCase();

/** Status of an expected/typed pair: 'ok' | 'case' | 'typo' | 'wrong'. */
function pairStatus(expected, typed) {
    const fe = fold(expected), ft = fold(typed);
    if (fe === ft) return isUpper(expected) === isUpper(typed) ? 'ok' : 'case';
    if (expected.length >= 4 && levenshtein(fe, ft) === 1) return 'typo';
    return 'wrong';
}

const SUBST_COST = { ok: 0, case: 0, typo: 0.5, wrong: 1 };

/**
 * Compare typed text with the expected sentence. Alignment: DP over words with cost 0 (same word),
 * 0.5 (typo), 1 (different word substitution, insertion, deletion). Ties on the backtrace (from the
 * end) prefer substitution, then a missing expected word, then an extra typed word.
 * @returns {{pass: boolean, words: {text: string, status: 'ok'|'case'|'typo'|'wrong'|'missing', typed: ?string}[], extra: string[]}}
 */
export function compareTyped(expected, typed) {
    const e = tokens(expected), t = tokens(typed);
    const n = e.length, m = t.length;
    const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) d[i][0] = i;
    for (let j = 1; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            d[i][j] = Math.min(d[i - 1][j - 1] + SUBST_COST[pairStatus(e[i - 1], t[j - 1])],
                d[i - 1][j] + 1, d[i][j - 1] + 1);
        }
    }
    const words = new Array(n);
    const extra = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + SUBST_COST[pairStatus(e[i - 1], t[j - 1])]) {
            words[i - 1] = { text: e[i - 1], status: pairStatus(e[i - 1], t[j - 1]), typed: t[j - 1] };
            i--; j--;
        } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
            words[i - 1] = { text: e[i - 1], status: 'missing', typed: null };
            i--;
        } else {
            extra.unshift(t[j - 1]);
            j--;
        }
    }
    const pass = extra.length === 0 && words.every(w => w.status !== 'wrong' && w.status !== 'missing');
    return { pass, words, extra };
}

/** Flags (per expected word) of one longest common subsequence of two folded token lists. */
function lcsFlags(e, h) {
    const n = e.length, m = h.length;
    const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            d[i][j] = e[i - 1] === h[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
        }
    }
    const flags = new Array(n).fill(false);
    let i = n, j = m;
    while (i > 0 && j > 0) {
        if (e[i - 1] === h[j - 1]) { flags[i - 1] = true; i--; j--; }
        else if (d[i - 1][j] >= d[i][j - 1]) i--;
        else j--;
    }
    return flags;
}

/**
 * Compare recognised speech alternatives with the sentence: per alternative the longest common
 * subsequence of folded words; the first alternative with the highest ratio wins.
 * @param {string} expected
 * @param {string[]} heard
 * @returns {{pass: boolean, ratio: number, best: string, words: {text: string, heard: boolean}[]}}
 */
export function speechMatch(expected, heard) {
    const e = tokens(expected);
    const fe = e.map(fold);
    let best = '', ratio = 0, flags = new Array(e.length).fill(false);
    for (const alt of Array.isArray(heard) ? heard : []) {
        const f = lcsFlags(fe, tokens(alt).map(fold));
        const r = e.length ? f.filter(Boolean).length / e.length : 0;
        if (r > ratio) {
            best = alt; ratio = r; flags = f;
        }
    }
    return { pass: ratio >= SPEECH_PASS, ratio, best, words: e.map((text, k) => ({ text, heard: flags[k] })) };
}
