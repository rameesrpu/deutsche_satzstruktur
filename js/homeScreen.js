// Learner screens outside the game and the editor: Home ("Lernen"), Üben and Wörter.
// The pure helpers at the top (chapter status, today's count, weak spots, article
// gender) are unit-tested; the render* functions build each screen's DOM into a
// container and call back into the app for every action (they never start a
// game or open the reader themselves).

import { STORY_CONTENT } from './storyContent.js';
import { reviewWeight } from './sentencePicker.js';
import { GRAMMAR_PALETTE } from './grammaticalConfig.js';
import { goalProgress } from './settings.js';

// --- Pure helpers ---

/**
 * Story chapters of every level in unlock order, with their story.
 * @returns {{level: string, key: string, id: string, label: string, drillKey: string,
 *   drillLabel: string, storyNo: number, storyTitle: string}[]}
 */
export function storyChapters() {
    return Object.entries(STORY_CONTENT).flatMap(([level, stories]) =>
        stories.flatMap(story => story.chapters.map(ch => ({
            level, key: ch.key, id: ch.id, label: ch.label, drillKey: ch.drillKey,
            drillLabel: ch.drillLabel, storyNo: story.story, storyTitle: story.title,
        }))));
}

/**
 * Status of each chapter: 'done' (complete), 'current' (the first unlocked one
 * not complete yet; at most one) or 'locked'. Unlocked chapters that are not
 * complete after the current one stay 'open' (only happens after an import).
 * @param {Object[]} chapters  from storyChapters()
 * @param {{isComplete: function(Object): boolean, isUnlocked: function(Object): boolean}} fns
 * @returns {Object[]} copies with `status`
 */
export function chapterStatuses(chapters, { isComplete, isUnlocked }) {
    let currentSeen = false;
    return chapters.map(ch => {
        let status;
        if (isComplete(ch)) status = 'done';
        else if (!isUnlocked(ch)) status = 'locked';
        else if (!currentSeen) { status = 'current'; currentSeen = true; }
        else status = 'open';
        return { ...ch, status };
    });
}

/**
 * Play stats of one sentence list.
 * @param {string[]} texts
 * @param {function(string): ?SentenceProgress} getEntry  progress of a sentence text
 * @returns {{total: number, played: number, correct: number}}  correct = played with no
 *   mistake in the last play
 */
export function sentenceStats(texts, getEntry) {
    let played = 0, correct = 0;
    for (const t of texts) {
        const e = getEntry(t);
        if (!e) continue;
        played++;
        if (e.lastMistakes === 0) correct++;
    }
    return { total: texts.length, played, correct };
}

/** Local midnight before `now` (ms). */
export function startOfDay(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Sentences last played today (each sentence counts once).
 * @param {GameProgress} progress
 * @param {number} now
 */
export function countPlayedToday(progress, now) {
    const since = startOfDay(now);
    return Object.values(progress.sentences).filter(e => e.lastPlayed >= since).length;
}

/**
 * Sentences "Schwächen üben" would pick from (review weight > 0).
 * @param {GameProgress} progress
 * @param {number} now
 */
export function countWeakSpots(progress, now) {
    return Object.values(progress.sentences).filter(e => reviewWeight(e, now) > 0).length;
}

/**
 * Grammar palette key of a glossary headword's article: "der Platz, Plätze" → 'masc',
 * "die Leute (pl.)" → 'pl', no article → null.
 * @param {string} de
 * @returns {?string}
 */
export function articleGender(de) {
    const m = /^(der|die|das)\s/.exec(de || '');
    if (!m) return null;
    if (/\((pl|Pl)\.?\)/.test(de)) return 'pl';
    return { der: 'masc', die: 'fem', das: 'neut' }[m[1]];
}

/** "Guten Morgen" / "Guten Tag" / "Guten Abend" for the local hour. */
export function greeting(now) {
    const h = new Date(now).getHours();
    return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
}

// --- DOM ---

const ICONS = {
    read: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
    review: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 ' +
        '1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 ' +
        '.3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 ' +
        '1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 ' +
        '1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const PLAY_ICON = '<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';

function icon(name) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Element helper: el('div', {className, onclick, ...}, child, 'text', …). */
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (k === 'html') node.innerHTML = v; // static icon markup only
        else if (k in node && k !== 'list') node[k] = v;
        else node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
}

function button(className, label, onClick, { iconHtml = '', disabled = false } = {}) {
    const b = el('button', { type: 'button', className, onclick: onClick, disabled });
    if (iconHtml) b.insertAdjacentHTML('afterbegin', iconHtml);
    b.append(label);
    return b;
}

function progressBar(fraction) {
    const fill = el('div', { className: 'home-progress-fill' });
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    return el('div', { className: 'home-progress' }, fill);
}

/** Today's goal as a ring (goalProgress result); a check in the middle once reached. */
function goalRing({ count, goal, fraction, reached }) {
    const r = 18, len = 2 * Math.PI * r;
    const done = fraction * len;
    return el('span', {
        className: 'home-ring', role: 'img', 'aria-label': `${count} von ${goal} Sätzen`,
        html: `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">` +
            `<circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>` +
            (count > 0 ? `<circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--success-500)" stroke-width="5" ` +
                `stroke-linecap="round" stroke-dasharray="${done.toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 22 22)"/>` : '') +
            (reached ? `<path d="M15 22.5l4.5 4.5L29 17.5" fill="none" stroke="var(--success-600)" stroke-width="2.5" ` +
                `stroke-linecap="round" stroke-linejoin="round"/>` : '') +
            `</svg>`,
    });
}

/** First narration line of a chapter, shortened for the "Weiter mit" card. */
function teaser(data) {
    const beat = data && data.beats && data.beats.find(b => b.read);
    if (!beat) return '';
    return beat.read.length > 120 ? beat.read.slice(0, 117).trimEnd() + '…' : beat.read;
}

function screenHead(title, sub = null) {
    return el('header', { className: 'screen-head' },
        sub ? el('span', { className: 'screen-kicker' }, sub) : null,
        el('h1', { className: 'screen-title' }, title));
}

/**
 * Home: "Weiter mit Kapitel …", today's goal, weak spots, the current story's chapters.
 * @param {HTMLElement} root
 * @param {Object} model
 * @param {Object[]} model.chapters   chapterStatuses() rows plus `data` (chapter file or null)
 *   and `stats` (sentenceStats)
 * @param {number} model.playedToday
 * @param {number} model.dailyGoal  sentences per day (settings.js)
 * @param {number} model.weakSpots
 * @param {number} model.now
 * @param {{read: function(Object), play: function(Object), review: function(), settings: function()}} actions
 */
export function renderHome(root, { chapters, playedToday, dailyGoal, weakSpots, now }, actions) {
    const date = new Date(now).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const current = chapters.find(c => c.status === 'current') ||
        chapters.find(c => c.status === 'open') || null;
    const allDone = !current && chapters.length > 0 && chapters.every(c => c.status === 'done');
    const focus = current || (allDone ? chapters[chapters.length - 1] : chapters[0]);

    const head = screenHead(greeting(now), date);
    const parts = [el('div', { className: 'screen-head-row' }, head,
        el('button', { type: 'button', className: 'screen-icon-btn', 'aria-label': 'Einstellungen',
            title: 'Einstellungen', onclick: () => actions.settings(), html: icon('gear') }))];
    const goal = goalProgress(playedToday, dailyGoal);

    if (focus) {
        const s = focus.stats;
        const started = s.played > 0;
        const kicker = allDone ? 'Alle Kapitel geschafft'
            : started ? `Weiter mit Kapitel ${focus.id}` : `Los geht's: Kapitel ${focus.id}`;
        const title = (focus.data && focus.data.title) || focus.label;
        parts.push(el('section', { className: 'home-card home-continue', 'aria-label': kicker },
            el('div', { className: 'home-continue-band' },
                el('span', {}, `Geschichte ${focus.storyNo} · ${focus.storyTitle}`)),
            el('div', { className: 'home-continue-body' },
                el('span', { className: 'home-muted' }, kicker),
                el('h2', { className: 'home-continue-title' }, title),
                teaser(focus.data) ? el('p', { className: 'home-continue-text' }, teaser(focus.data)) : null,
                s.total > 0 ? el('div', { className: 'home-progress-row' },
                    progressBar(s.played / s.total),
                    el('span', { className: 'home-muted' }, `${s.played} von ${s.total} Sätzen`)) : null,
                el('div', { className: 'home-actions' },
                    button('home-btn home-btn-primary', 'Lesen', () => actions.read(focus), { iconHtml: icon('read') }),
                    button('home-btn home-btn-secondary', 'Spielen', () => actions.play(focus), { iconHtml: PLAY_ICON })))));
    }

    parts.push(el('div', { className: 'home-tiles' },
        el('div', { className: `home-card home-tile home-goal${goal.reached ? ' is-reached' : ''}` },
            goalRing(goal),
            el('span', { className: 'home-tile-text' },
                el('strong', {}, `${goal.count}/${goal.goal}`),
                el('span', { className: 'home-muted' }, goal.label))),
        el('button', {
            type: 'button', className: 'home-card home-tile home-tile-btn', disabled: weakSpots === 0,
            onclick: () => actions.review(),
            title: weakSpots === 0 ? 'Noch keine Fehler zum Üben' : 'Sätze mit Fehlern nochmal spielen',
        },
            el('span', { className: 'home-tile-icon', html: icon('review') }),
            el('span', { className: 'home-tile-text' },
                el('strong', {}, String(weakSpots)),
                el('span', { className: 'home-muted' }, 'Schwächen üben')))));

    if (focus) {
        const storyRows = chapters.filter(c => c.level === focus.level && c.storyNo === focus.storyNo);
        parts.push(el('section', { className: 'home-chapters' },
            el('div', { className: 'home-section-head' },
                el('h3', {}, focus.storyTitle),
                el('span', { className: 'home-muted' }, `${storyRows.length} Kapitel`)),
            el('ul', { className: 'home-card home-chapter-list' },
                storyRows.map(ch => chapterRow(ch, chapters, actions)))));
    }

    root.replaceChildren(el('div', { className: 'screen-inner' }, parts));
}

function chapterRow(ch, all, actions) {
    const s = ch.stats;
    let sub;
    if (ch.status === 'done') {
        sub = `${s.total} Sätze · ${s.played ? Math.round(100 * s.correct / s.played) : 0} % richtig`;
    } else if (ch.status === 'locked') {
        const prev = all[all.indexOf(ch) - 1];
        sub = prev && prev.status !== 'locked' ? `Nach Kapitel ${prev.id}` : 'Gesperrt';
    } else {
        sub = s.played > 0 ? `${s.played} von ${s.total} gespielt` : 'Jetzt dran';
    }
    const mark = el('span', { className: `home-chapter-mark is-${ch.status}` });
    if (ch.status === 'done') mark.innerHTML = icon('check');
    else if (ch.status === 'locked') mark.innerHTML = icon('lock');
    else mark.textContent = ch.id;
    const body = [mark,
        el('span', { className: 'home-chapter-text' },
            el('span', { className: 'home-chapter-title' }, ch.label),
            el('span', { className: 'home-muted' }, sub))];
    if (ch.status === 'locked') {
        return el('li', { className: 'home-chapter is-locked', 'aria-disabled': 'true' }, body);
    }
    return el('li', { className: 'home-chapter' },
        el('button', { type: 'button', className: 'home-chapter-btn', onclick: () => actions.read(ch),
            'aria-label': `${ch.label} lesen` },
        body, el('span', { className: 'home-chapter-go', html: icon('chevron') })));
}

/**
 * Üben: weak spots, the drills of unlocked chapters, and the grammar categories.
 * @param {HTMLElement} root
 * @param {{weakSpots: number, drills: {level, key, label}[], grammar: {level, label, categories: {key, label}[]}[]}} model
 * @param {{review: function(), play: function(string, string)}} actions  play(level, categoryKey)
 */
export function renderPractice(root, { weakSpots, drills, grammar }, actions) {
    const listOf = (items, level) => el('ul', { className: 'home-card home-chapter-list' },
        items.map(it => el('li', { className: 'home-chapter' },
            el('button', { type: 'button', className: 'home-chapter-btn',
                onclick: () => actions.play(it.level || level, it.key) },
            el('span', { className: 'home-chapter-text' },
                el('span', { className: 'home-chapter-title' }, it.label)),
            el('span', { className: 'home-chapter-go', html: icon('chevron') })))));

    const parts = [screenHead('Üben')];
    parts.push(button('home-card home-wide-btn', `Schwächen üben (${weakSpots})`, () => actions.review(),
        { iconHtml: icon('review'), disabled: weakSpots === 0 }));
    if (drills.length > 0) {
        parts.push(el('section', { className: 'home-chapters' },
            el('div', { className: 'home-section-head' }, el('h3', {}, 'Übungen zu den Kapiteln')),
            listOf(drills)));
    }
    parts.push(el('section', { className: 'home-chapters' },
        el('div', { className: 'home-section-head' }, el('h3', {}, 'Grammatik')),
        grammar.map(g => el('details', { className: 'practice-level' },
            el('summary', {}, g.label), listOf(g.categories, g.level)))));
    root.replaceChildren(el('div', { className: 'screen-inner' }, parts));
}

/**
 * Wörter: the glossary of every unlocked chapter, articles in their gender color.
 * @param {HTMLElement} root
 * @param {{chapters: {label: string, entries: {de: string, en: string}[]}[]}} model
 */
export function renderWords(root, { chapters }) {
    const parts = [screenHead('Wörter', 'Aus deinen Kapiteln')];
    if (chapters.length === 0) {
        parts.push(el('p', { className: 'home-muted' }, 'Noch keine Wörter. Lies das erste Kapitel!'));
    }
    for (const ch of chapters) {
        parts.push(el('section', { className: 'home-chapters' },
            el('div', { className: 'home-section-head' },
                el('h3', {}, ch.label),
                el('span', { className: 'home-muted' }, `${ch.entries.length} Wörter`)),
            el('ul', { className: 'home-card words-list' }, ch.entries.map(wordRow))));
    }
    root.replaceChildren(el('div', { className: 'screen-inner' }, parts));
}

function wordRow({ de, en }) {
    const gender = articleGender(de);
    const word = el('span', { className: 'words-de', lang: 'de' });
    if (gender) {
        const space = de.indexOf(' ');
        const article = el('span', { className: 'words-article' }, de.slice(0, space));
        article.style.color = GRAMMAR_PALETTE[gender].ink;
        word.append(article, de.slice(space));
    } else {
        word.textContent = de;
    }
    return el('li', { className: 'words-row' }, word, el('span', { className: 'words-en', lang: 'en' }, en));
}
