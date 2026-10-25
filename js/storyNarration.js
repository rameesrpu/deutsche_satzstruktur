// Story chapters in game mode: which narration to show before a play sentence,
// and the narration card itself (a DOM overlay above the game canvas).
// Beat format: data/stories/CURRICULUM.md; chapter files are built by
// scripts/build_stories.py. The helpers at the top are pure (no DOM).

/**
 * @typedef {Object} StoryBeat
 * @property {string} [read]     narration/dialogue shown between rounds, never scored
 * @property {string} [play]     sentence played in game mode
 * @property {string} [speaker]  who says it (absent = narrator)
 */

/**
 * The beats leading up to a play sentence: the read beats after the previous
 * play beat, plus the play beat itself.
 * @param {StoryBeat[]} beats
 * @param {string} text  play sentence text
 * @returns {?{lines: StoryBeat[], play: StoryBeat}}  null if `text` is not a play beat
 */
export function beatsBefore(beats, text) {
    const idx = beats.findIndex(b => b.play && b.play.trim() === text.trim());
    if (idx < 0) return null;
    let start = idx;
    while (start > 0 && !beats[start - 1].play) start--;
    return { lines: beats.slice(start, idx), play: beats[idx] };
}

/**
 * The read beats after the last play beat (the chapter's ending).
 * @param {StoryBeat[]} beats
 * @returns {StoryBeat[]}
 */
export function beatsAfterLast(beats) {
    let i = beats.length;
    while (i > 0 && !beats[i - 1].play) i--;
    return beats.slice(i);
}

/**
 * The play sentence after `text` in `texts`, or null at the end (or if unknown).
 * @param {string[]} texts
 * @param {string} text
 * @returns {?string}
 */
export function nextPlayText(texts, text) {
    const idx = texts.indexOf(text);
    return idx >= 0 && idx + 1 < texts.length ? texts[idx + 1] : null;
}

/**
 * Where to start a chapter: `currentText` if it belongs to the chapter, else the
 * first sentence not yet played, else the first sentence.
 * @param {string[]} texts
 * @param {?string} currentText
 * @param {(text: string) => boolean} hasPlayed
 * @returns {?string}
 */
export function chapterStartText(texts, currentText, hasPlayed) {
    if (currentText && texts.includes(currentText)) return currentText;
    return texts.find(t => !hasPlayed(t)) || texts[0] || null;
}

// ---------------------------------------------------------------------------
// Narration card (DOM)
// ---------------------------------------------------------------------------

const CARD_ID = 'story-card';

/** @returns {boolean} */
export function isStoryCardOpen() {
    return !!document.getElementById(CARD_ID);
}

export function hideStoryCard() {
    const el = document.getElementById(CARD_ID);
    if (el) {
        if (el._onKey) document.removeEventListener('keydown', el._onKey, true);
        el.remove();
    }
}

function lineElement(beat, extraClass = '') {
    const row = document.createElement('div');
    row.className = 'story-line' + (beat.speaker ? ' story-line-speech' : '') + extraClass;
    if (beat.speaker) {
        const who = document.createElement('span');
        who.className = 'story-speaker';
        who.textContent = beat.speaker;
        row.appendChild(who);
    }
    const text = document.createElement('span');
    text.className = 'story-text';
    text.textContent = beat.read || beat.play || '';
    row.appendChild(text);
    return row;
}

/**
 * Show the narration card. Enter/Space press the primary button.
 * @param {Object} opts
 * @param {string} opts.heading            e.g. "1.1 Hallo, Stuttgart!"
 * @param {StoryBeat[]} opts.lines         narration shown first
 * @param {?StoryBeat} [opts.play]         the sentence about to be played (highlighted)
 * @param {?string} [opts.banner]          e.g. "Kapitel geschafft!"
 * @param {{label: string, onClick: Function, primary?: boolean}[]} opts.buttons
 * @param {?Function} [opts.onSpeak]       shows a 🔊 button that calls it with the card's texts
 */
export function showStoryCard({ heading, lines, play = null, banner = null, buttons, onSpeak = null }) {
    hideStoryCard();
    const backdrop = document.createElement('div');
    backdrop.id = CARD_ID;
    backdrop.className = 'story-backdrop';

    const card = document.createElement('div');
    card.className = 'story-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', heading);

    const head = document.createElement('div');
    head.className = 'story-heading';
    head.textContent = heading;
    card.appendChild(head);

    if (banner) {
        const b = document.createElement('div');
        b.className = 'story-banner';
        b.textContent = banner;
        card.appendChild(b);
    }

    const body = document.createElement('div');
    body.className = 'story-body';
    lines.forEach(beat => body.appendChild(lineElement(beat)));
    if (play) {
        const label = document.createElement('div');
        label.className = 'story-play-label';
        label.textContent = 'Jetzt du:';
        body.appendChild(label);
        body.appendChild(lineElement(play, ' story-line-play'));
    }
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'story-actions';
    if (onSpeak) {
        const speak = document.createElement('button');
        speak.className = 'story-btn story-btn-icon';
        speak.title = 'Vorlesen';
        speak.textContent = '🔊';
        const texts = [...lines, ...(play ? [play] : [])].map(b => b.read || b.play);
        speak.addEventListener('click', () => onSpeak(texts));
        actions.appendChild(speak);
    }
    let primary = null;
    buttons.forEach(btn => {
        const el = document.createElement('button');
        el.className = 'story-btn' + (btn.primary ? ' story-btn-primary' : '');
        el.textContent = btn.label;
        el.addEventListener('click', () => btn.onClick());
        actions.appendChild(el);
        if (btn.primary) primary = el;
    });
    card.appendChild(actions);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    body.scrollTop = body.scrollHeight;

    // Capture phase: game/app key handlers must not see keys while the card is open
    backdrop._onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (primary) primary.click();
        } else if (!e.ctrlKey && !e.metaKey) {
            e.stopPropagation();
        }
    };
    document.addEventListener('keydown', backdrop._onKey, true);
    if (primary) primary.focus();
}
