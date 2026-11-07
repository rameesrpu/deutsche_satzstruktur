/**
 * Play screen chrome (U5, docs/redesign-plan.md): the HTML around the game grid when the
 * game runs full-screen (body[data-screen="play"]): top bar (close, segmented progress,
 * score), the sentence with the current phrase framed, the feedback bar and the case tray.
 * The grid itself stays SVG (gamemode.js). In the Werkstatt the game keeps its SVG HUD.
 * Display only — reads GameMode state; taps call GameMode/app methods.
 * The helpers at the top are pure (no DOM) and unit-tested in tests/playScreen.test.js.
 */

/** Sentences per progress bar outside a story chapter (review, random, drills). */
export const SESSION_SEGMENTS = 10;

/**
 * One state per progress segment.
 * @param {number} total     segments (sentences in the chapter / session window)
 * @param {number} index     the current sentence (0-based)
 * @param {boolean} currentDone  the current sentence is finished
 * @returns {('done'|'current'|'todo')[]}
 */
export function progressSegments(total, index, currentDone = false) {
    return Array.from({ length: Math.max(0, total) }, (_, i) =>
        i < index || (i === index && currentDone) ? 'done' : i === index ? 'current' : 'todo');
}

/**
 * The sentence as shown above the grid, in sentence order: words before the current phrase
 * (already placed or auto-placed) are 'past', the phrase to place is one 'current' part, the
 * words up to `revealEnd` are 'next' (the old word bar's preview); later words stay hidden
 * (`more` = there are hidden words). `range` null = sentence complete: everything 'past'.
 * @param {string[]} texts      word texts of the sentence
 * @param {?[number, number]} range  word indices [start, end] of the current phrase
 * @param {number} revealEnd    last word index shown as 'next' (< start of range = none)
 * @returns {{parts: {text: string, kind: 'past'|'current'|'next'}[], more: boolean}}
 */
export function sentenceParts(texts, range, revealEnd = -1) {
    if (!range) return { parts: texts.length ? [{ text: texts.join(' '), kind: 'past' }] : [], more: false };
    const [start, end] = range;
    const parts = [];
    if (start > 0) parts.push({ text: texts.slice(0, start).join(' '), kind: 'past' });
    parts.push({ text: texts.slice(start, end + 1).join(' '), kind: 'current' });
    const last = Math.min(Math.max(revealEnd, end), texts.length - 1);
    if (last > end) parts.push({ text: texts.slice(end + 1, last + 1).join(' '), kind: 'next' });
    return { parts, more: last < texts.length - 1 };
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const CASES = [
    { key: 'nom', label: 'NOM', name: 'Nominativ', hotkey: 'A', shape: '<circle cx="12" cy="12" r="8"/>' },
    { key: 'akk', label: 'AKK', name: 'Akkusativ', hotkey: 'S', shape: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>' },
    { key: 'dat', label: 'DAT', name: 'Dativ', hotkey: 'D', shape: '<path d="M8 5h8l4.5 14h-17z"/>' },
    { key: 'gen', label: 'GEN', name: 'Genitiv', hotkey: 'F', shape: '<path d="M12 2.5l9.5 9.5-9.5 9.5-9.5-9.5z"/>' },
];

const svgIcon = (body, size = 22, extra = '') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

const ICONS = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    streak: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2.3 3.1C11 9 11 6 12 3z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
};

let wired = false;

/**
 * Build the static chrome once and wire it to the game.
 * @param {import('./gamemode.js').GameMode} game
 * @param {{onClose: Function, onContinue: Function}} actions
 */
export function initPlayChrome(game, { onClose, onContinue }) {
    if (wired) return;
    const container = document.querySelector('.canvas-container');
    const svg = document.getElementById('canvas');
    if (!container || !svg) return;
    wired = true;

    const top = document.createElement('div');
    top.className = 'play-top';
    top.id = 'play-top';
    top.innerHTML =
        `<div class="play-bar">` +
            `<button type="button" class="play-close" id="play-close" aria-label="Spiel beenden" title="Beenden">${svgIcon(ICONS.close)}</button>` +
            `<div class="play-progress" id="play-progress" role="progressbar" aria-label="Fortschritt"></div>` +
            `<div class="play-score" aria-label="Punkte">` +
                `<span class="play-streak" id="play-streak" hidden></span>` +
                `<span class="play-score-value" id="play-score-value">0</span>` +
                `<span class="play-score-target" id="play-score-target"></span>` +
            `</div>` +
        `</div>` +
        `<div class="play-sentence" id="play-sentence">` +
            `<div class="play-prompt" id="play-prompt"></div>` +
            `<p class="play-sentence-text" id="play-sentence-text" lang="de"></p>` +
            `<div class="play-timer" id="play-timer" hidden><div class="play-timer-fill" id="play-timer-fill"></div></div>` +
        `</div>`;
    container.insertBefore(top, svg);

    const bottom = document.createElement('div');
    bottom.className = 'play-bottom';
    bottom.id = 'play-bottom';
    bottom.innerHTML =
        `<div class="play-feedback-slot"><div class="play-feedback" id="play-feedback" role="status" aria-live="polite" hidden></div></div>` +
        `<div class="play-tray" id="play-tray" role="group" aria-label="Kasus">` +
            CASES.map(c => `<button type="button" class="play-case" data-case="${c.key}" aria-pressed="false" ` +
                `title="${c.name} (Taste ${c.hotkey})">${svgIcon(c.shape, 26, ' class="play-case-shape"')}` +
                `<span class="play-case-label">${c.label}</span></button>`).join('') +
        `</div>` +
        `<button type="button" class="play-continue" id="play-continue" hidden></button>`;
    container.appendChild(bottom);

    top.querySelector('#play-close').addEventListener('click', () => onClose());
    bottom.querySelectorAll('.play-case').forEach(btn =>
        btn.addEventListener('click', () => game.toggleCase(btn.dataset.case)));
    bottom.querySelector('#play-continue').addEventListener('click', () => onContinue());
}

/** Progress of the current sentence: story chapter sentences, replay list, else a session window. */
function progressState(game) {
    const chapter = game.getStoryChapter();
    const done = game.waitingForContinue;
    if (game.replay) {
        const idx = game.replay.ids.indexOf(game.host.sentenceManager.currentSentenceId);
        if (idx >= 0) return progressSegments(game.replay.ids.length, idx, done);
    }
    if (chapter) {
        const sentence = game.host.sentenceManager.getCurrentSentence();
        const idx = chapter.data.sentences.indexOf(sentence && sentence.text);
        if (idx >= 0) return progressSegments(chapter.data.sentences.length, idx, done);
    }
    const n = game.sentencesCompleted - (done ? 1 : 0);
    return progressSegments(SESSION_SEGMENTS, n % SESSION_SEGMENTS, done);
}

/** The sentence parts for the word currently being placed (same reveal as the old word bar). */
function currentSentenceParts(game) {
    const texts = game.words.map(w => w.text);
    const item = game.manualItems && game.manualItems[game.currentIndex];
    if (!item || game.waitingForContinue) return sentenceParts(texts, null);
    const range = game.getItemWordRange(item);
    // Preview = the word after the phrase; if it starts a phrase box, the whole box
    let revealEnd = range[1];
    const nextWord = game.words[range[1] + 1];
    if (nextWord) {
        const nextManual = game.wordToManualItem.get(nextWord);
        revealEnd = nextManual && nextManual.type === 'box'
            ? game.getItemWordRange(nextManual)[1] : range[1] + 1;
    }
    return sentenceParts(texts, range, revealEnd);
}

function renderFeedback(el, game) {
    // After the last placement its explanation stays (often the noun with its article);
    // the prompt above the sentence says the sentence is done
    let fb = game.feedback;
    if (!fb && game.waitingForContinue && game.manualItems.length > 0) {
        fb = { tone: 'ok', title: 'Satz fertig!', form: null,
            lines: [`+${game.currentSentenceScore} Punkte für diesen Satz`] };
    }
    el.hidden = !fb;
    if (!fb) { el.innerHTML = ''; return; }
    el.className = `play-feedback play-feedback-${fb.tone}`;
    el.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = 'play-feedback-icon';
    icon.innerHTML = svgIcon(fb.tone === 'wrong' ? ICONS.cross : fb.tone === 'solved' ? ICONS.bulb : ICONS.check, 18);
    el.appendChild(icon);
    const text = document.createElement('div');
    text.className = 'play-feedback-text';
    const title = document.createElement('div');
    title.className = 'play-feedback-title';
    title.textContent = fb.title;
    if (fb.form) {
        const form = document.createElement('span');
        form.className = 'play-feedback-form';
        form.textContent = `→ ${fb.form}`;
        title.append(' ', form);
    }
    text.appendChild(title);
    fb.lines.forEach(line => {
        const row = document.createElement('div');
        row.className = 'play-feedback-line';
        row.textContent = line;
        text.appendChild(row);
    });
    el.appendChild(text);
}

/**
 * Refresh the chrome from the game state (called on every redraw of the play screen).
 * @param {import('./gamemode.js').GameMode} game
 * @param {string} view  app.currentView: 'game' or 'felder' (review after a sentence)
 */
export function renderPlayChrome(game, view) {
    const top = document.getElementById('play-top');
    if (!top || !game.isActive) return;
    const review = view !== 'game';
    document.body.dataset.playView = review ? 'review' : 'game';

    // Top bar
    const progress = document.getElementById('play-progress');
    const segs = progressState(game);
    progress.innerHTML = segs.map(s => `<span class="play-seg play-seg-${s}"></span>`).join('');
    const doneCount = segs.filter(s => s === 'done').length;
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(segs.length));
    progress.setAttribute('aria-valuenow', String(doneCount));
    document.getElementById('play-score-value').textContent = String(game.getDisplayedScore());
    document.getElementById('play-score-target').textContent = `/${game.targetScore}`;
    const streak = document.getElementById('play-streak');
    streak.hidden = game.displayStreak < 2;
    streak.innerHTML = game.displayStreak >= 2 ? `${svgIcon(ICONS.streak, 14)}${game.displayStreak}` : '';
    streak.title = `${game.displayStreak} richtig in Folge`;

    // Sentence
    const complete = game.waitingForContinue || !game.manualItems.length;
    document.getElementById('play-prompt').textContent = !complete ? 'Wohin gehört der markierte Teil?'
        : game.manualItems.length ? `Satz fertig · +${game.currentSentenceScore} Punkte` : 'Satz fertig';
    const textEl = document.getElementById('play-sentence-text');
    textEl.innerHTML = '';
    const { parts, more } = currentSentenceParts(game);
    parts.forEach((part, i) => {
        if (i > 0) textEl.append(' ');
        const span = document.createElement('span');
        span.className = `play-part play-part-${part.kind}`;
        if (part.kind === 'current' && Date.now() < game.wrongShakeUntil) span.classList.add('play-shake');
        span.textContent = part.text;
        textEl.appendChild(span);
    });
    if (more) {
        const dots = document.createElement('span');
        dots.className = 'play-part play-part-more';
        dots.textContent = ' …';
        textEl.appendChild(dots);
    }
    textEl.classList.toggle('is-complete', complete);
    const timer = document.getElementById('play-timer');
    timer.hidden = !(game.timeChallengeMode && game.wordStartTime !== null && !complete);

    // Feedback, tray / continue
    renderFeedback(document.getElementById('play-feedback'), game);
    const tray = document.getElementById('play-tray');
    tray.hidden = complete;
    tray.querySelectorAll('.play-case').forEach(btn => {
        const on = game.selectedCase === btn.dataset.case;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    const cont = document.getElementById('play-continue');
    cont.hidden = !game.waitingForContinue;
    cont.innerHTML = `<span>${game.pendingFelderReview ? 'Satzbau ansehen' : 'Nächster Satz'}</span>${svgIcon(ICONS.next, 20)}`;
}

/** Leave the play screen: drop the view flag used by the CSS. */
export function clearPlayChrome() {
    delete document.body.dataset.playView;
}

/** Update the DOM timer bar in place (rAF loop in gamemode.js). */
export function updatePlayTimer(remaining, color) {
    const fill = document.getElementById('play-timer-fill');
    if (!fill) return;
    fill.style.width = `${Math.max(0, remaining) * 100}%`;
    fill.style.background = color;
    fill.classList.toggle('gm-timer-pulse', remaining < 0.3 && remaining > 0);
}
