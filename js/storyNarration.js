// Story chapters in game mode: which narration to show before a play sentence,
// and the narration card itself (a DOM overlay above the game canvas).
// Beat format: data/stories/CURRICULUM.md; chapter files are built by
// scripts/build_stories.py. The helpers at the top are pure (no DOM).

import { renderGlossedText, closeGlossPopover } from './glossary.js';
import { gameSounds } from './sound.js';

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
 * The story line above the sentence on the play screen: the last `max` read beats
 * before it; `more` = earlier beats were cut (the "mehr" sheet shows them all).
 * @param {StoryBeat[]} lines  e.g. `beatsBefore(...).lines`
 * @param {number} [max]
 * @returns {{lines: StoryBeat[], more: boolean}}
 */
export function storyStrip(lines, max = 2) {
    const read = (lines || []).filter(b => b && b.read);
    const shown = max > 0 ? read.slice(-max) : [];
    return { lines: shown, more: read.length > shown.length };
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

/**
 * Chapter picture (built from data/stories/<level>/img/<id>.*, see build_stories.py).
 * @typedef {Object} StoryImage
 * @property {string} src  repo-relative path with a content-hash `?v=`
 * @property {string} alt  German description of the scene
 */

/**
 * `<img>` for a chapter picture, or null without one. Lazy, and removes itself if the
 * file fails to load, so a missing picture never leaves a broken box.
 * @param {?StoryImage} image
 * @param {string} className
 * @returns {?HTMLImageElement}
 */
export function storyImageElement(image, className) {
    if (!image || !image.src) return null;
    const img = document.createElement('img');
    img.className = className;
    img.src = image.src;
    img.alt = image.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.remove());
    return img;
}
const SVG_NS = 'http://www.w3.org/2000/svg';

// Inline stroke icons (24-unit viewBox, currentColor); 'play' is filled
const ICONS = {
    speaker: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
    book: ['M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M8 7h7'],
    next: ['M9 6l6 6-6 6'],
    play: ['M7 4l13 8-13 8z'],
};

function icon(name, size = 18) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const filled = name === 'play';
    svg.setAttribute('fill', filled ? 'currentColor' : 'none');
    svg.setAttribute('stroke', filled ? 'none' : 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const d of ICONS[name]) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    }
    return svg;
}

/** @returns {boolean} */
export function isStoryCardOpen() {
    return !!document.getElementById(CARD_ID);
}

export function hideStoryCard() {
    closeGlossPopover();
    const el = document.getElementById(CARD_ID);
    if (el) {
        if (el._onKey) document.removeEventListener('keydown', el._onKey, true);
        el.remove();
    }
}

/**
 * One beat as a card/reader line: speaker label (if any) and the text, with
 * glossary words tappable.
 * @param {StoryBeat} beat
 * @param {string} [extraClass]  e.g. ' story-line-play'
 * @param {Object<string, import('./glossary.js').GlossaryEntry>} [glossary]
 * @returns {HTMLElement}
 */
export function storyLineElement(beat, extraClass = '', glossary = null) {
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
    renderGlossedText(text, beat.read || beat.play || '', glossary);
    row.appendChild(text);
    return row;
}

/**
 * Show the narration card: a solid bottom sheet over the game (no scrim, so the grid
 * stays visible above it). Enter/Space press the primary button.
 * @param {Object} opts
 * @param {string} opts.heading            e.g. "1.1 Hallo, Stuttgart!"
 * @param {StoryBeat[]} opts.lines         narration shown first
 * @param {?StoryBeat} [opts.play]         the sentence about to be played (highlighted)
 * @param {?string} [opts.banner]          e.g. "Kapitel geschafft!"
 * @param {{label: string, onClick: Function, primary?: boolean, icon?: 'book'|'next'|'play'}[]} opts.buttons
 * @param {?Function} [opts.onSpeak]       shows a read-aloud button that calls it with the card's texts
 *                                         (disabled when the device has no German voice)
 * @param {?Object} [opts.glossary]        chapter glossary: its words are tappable
 * @param {?StoryImage} [opts.image]        chapter picture above the text (chapter's first card)
 */
export function showStoryCard({ heading, lines, play = null, banner = null, buttons, onSpeak = null, glossary = null,
    image = null }) {
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

    const picture = storyImageElement(image, 'story-image');
    if (picture) card.appendChild(picture);

    if (banner) {
        const b = document.createElement('div');
        b.className = 'story-banner';
        b.textContent = banner;
        card.appendChild(b);
    }

    const body = document.createElement('div');
    body.className = 'story-body';
    lines.forEach(beat => body.appendChild(storyLineElement(beat, '', glossary)));
    if (play) {
        const label = document.createElement('div');
        label.className = 'story-play-label';
        label.textContent = 'Jetzt du:';
        body.appendChild(label);
        body.appendChild(storyLineElement(play, ' story-line-play', glossary));
    }
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'story-actions';
    if (onSpeak) {
        const speak = document.createElement('button');
        speak.type = 'button';
        speak.className = 'story-btn story-btn-icon';
        const canSpeak = gameSounds.speechAvailable && 'speechSynthesis' in window;
        speak.title = canSpeak ? 'Vorlesen' : 'Keine deutsche Stimme auf diesem Gerät';
        speak.setAttribute('aria-label', speak.title);
        speak.disabled = !canSpeak;
        speak.appendChild(icon('speaker', 20));
        const texts = [...lines, ...(play ? [play] : [])].map(b => b.read || b.play);
        speak.addEventListener('click', () => onSpeak(texts));
        actions.appendChild(speak);
    }
    let primary = null;
    buttons.forEach(btn => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'story-btn' + (btn.primary ? ' story-btn-primary' : '');
        // Primary: label then icon (→ / ▶); secondary: icon then label
        const label = document.createElement('span');
        label.textContent = btn.label;
        if (btn.icon && btn.primary) el.append(label, icon(btn.icon, 16));
        else if (btn.icon) el.append(icon(btn.icon, 18), label);
        else el.append(label);
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
