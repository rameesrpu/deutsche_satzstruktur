// Story reader: a full-screen page showing one chapter as a story (all beats in
// order) before it is played. Glossary words are tappable: their meaning shows
// in a bottom bar (glossary.js renders the words). Play sentences, the ones
// placed in game mode, get a small green dot after them.

import { renderGlossedText, speakableForm } from './glossary.js';
import { gameSounds } from './sound.js';

const READER_ID = 'story-reader';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Group beats into paragraphs: every beat starts one, except that a run of
 * play sentences without a speaker reads as one paragraph
 * ("Sie heißt Ayisha. Ayisha ist Ärztin. Ihre Heimat ist Kerala.").
 * @param {import('./storyNarration.js').StoryBeat[]} beats
 * @returns {import('./storyNarration.js').StoryBeat[][]}
 */
export function readerParagraphs(beats) {
    const paras = [];
    let prev = null;
    for (const beat of beats) {
        const joins = prev && !prev.speaker && !beat.speaker && prev.play && beat.play;
        if (joins) paras[paras.length - 1].push(beat);
        else paras.push([beat]);
        prev = beat;
    }
    return paras;
}

/**
 * Header label and page title from the reader's heading/subheading:
 * ("1.1 Hallo, Stuttgart!", "Geschichte 1: Ankunft") → label
 * "Ankunft · Kapitel 1.1", title "Hallo, Stuttgart!". Other shapes are kept as they are.
 * @param {string} heading
 * @param {?string} subheading
 * @returns {{label: string, title: string}}
 */
export function readerTitles(heading, subheading) {
    const m = /^(\d+(?:\.\d+)*)\s+(.+)$/.exec(heading || '');
    const story = subheading ? subheading.replace(/^Geschichte\s+\d+:\s*/, '') : '';
    if (!m) return { label: story, title: heading || '' };
    return { label: story ? `${story} · Kapitel ${m[1]}` : `Kapitel ${m[1]}`, title: m[2] };
}

/**
 * How far the page has been read (0..1): the share of the text above the
 * bottom of the viewport. A page that fits on the screen counts as read.
 * @param {number} scrollTop
 * @param {number} clientHeight
 * @param {number} scrollHeight
 * @returns {number}
 */
export function readProgress(scrollTop, clientHeight, scrollHeight) {
    if (scrollHeight <= clientHeight) return 1;
    return Math.max(0, Math.min(1, (scrollTop + clientHeight) / scrollHeight));
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
    back: ['M15 18l-6-6 6-6'],
    speaker: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
    speakerSmall: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7'],
    stop: ['M7 7h10v10H7z'],
    close: ['M6 6l12 12M18 6L6 18'],
    next: ['M9 6l6 6-6 6'],
};

/** Inline stroke icon (24-unit viewBox, currentColor). */
function icon(name, size = 20) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    }
    return svg;
}

/** Filled play triangle for "Jetzt spielen". */
function playIcon() {
    const svg = icon('next', 16);
    svg.textContent = '';
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('stroke', 'none');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M7 4l13 8-13 8z');
    svg.appendChild(path);
    return svg;
}

function iconButton(name, label, className, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.title = label;
    el.setAttribute('aria-label', label);
    el.appendChild(icon(name));
    el.addEventListener('click', onClick);
    return el;
}

function speechUsable() {
    return gameSounds.speechAvailable && gameSounds.speechEnabled && 'speechSynthesis' in window;
}

function speechHint() {
    if (!('speechSynthesis' in window) || !gameSounds.speechAvailable) return 'Keine deutsche Stimme auf diesem Gerät';
    if (!gameSounds.speechEnabled) return 'Sprachausgabe ist in den Einstellungen aus';
    return null;
}

/** @returns {boolean} */
export function isStoryReaderOpen() {
    return !!document.getElementById(READER_ID);
}

/** Remove the reader (no onClose: that is only for the reader's own back button / Esc). */
export function hideStoryReader() {
    const el = document.getElementById(READER_ID);
    if (!el) return;
    window.removeEventListener('keydown', el._onKey, true);
    if (el._stopReading) el._stopReading();
    el.remove();
}

/**
 * Show the reader for one chapter, replacing an open one.
 * @param {Object} opts
 * @param {string} opts.heading           e.g. "1.1 Hallo, Stuttgart!"
 * @param {?string} [opts.subheading]     e.g. "Geschichte 1: Ankunft"
 * @param {import('./storyNarration.js').StoryBeat[]} opts.beats
 * @param {Object} [opts.glossary]        chapter glossary (headword → entry)
 * @param {Function} opts.onPlay          "Jetzt spielen": start the chapter
 * @param {?Function} [opts.onNext]       "Weiterlesen": next chapter (null = locked / last)
 * @param {?Function} [opts.onClose]      after the reader is closed with back or Esc
 */
export function showStoryReader({ heading, subheading = null, beats, glossary = {}, onPlay, onNext = null, onClose = null }) {
    hideStoryReader();
    const close = () => {
        hideStoryReader();
        if (onClose) onClose();
    };
    const { label, title } = readerTitles(heading, subheading);

    const reader = document.createElement('div');
    reader.id = READER_ID;
    reader.className = 'story-reader';
    reader.setAttribute('role', 'dialog');
    reader.setAttribute('aria-label', heading);

    // --- Header: back, chapter + reading progress, read aloud ---
    const head = document.createElement('div');
    head.className = 'story-reader-head';
    head.appendChild(iconButton('back', 'Zurück', 'story-reader-iconbtn', close));

    const meta = document.createElement('div');
    meta.className = 'story-reader-meta';
    const labelEl = document.createElement('span');
    labelEl.className = 'story-reader-label';
    labelEl.textContent = label;
    const bar = document.createElement('div');
    bar.className = 'story-reader-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Gelesen');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = document.createElement('div');
    fill.className = 'story-reader-progress-fill';
    bar.appendChild(fill);
    meta.append(labelEl, bar);
    head.appendChild(meta);

    const texts = beats.map(b => b.read || b.play).filter(Boolean);
    let reading = false;
    let readTimer = null;
    const aloud = iconButton('speaker', 'Vorlesen', 'story-reader-iconbtn', () => {
        if (reading) { stopReading(); return; }
        if (!speechUsable()) { syncAloud(); return; }
        texts.forEach((t, i) => gameSounds.speak(t, { queue: i > 0 }));
        reading = true;
        syncAloud();
        // speak() has no end callback: watch the engine until it goes quiet
        readTimer = setInterval(() => {
            if (!speechSynthesis.speaking && !speechSynthesis.pending) stopReading(false);
        }, 400);
    });
    function syncAloud() {
        const hint = speechHint();
        aloud.disabled = !!hint && !reading;
        const label = reading ? 'Vorlesen stoppen' : (hint || 'Vorlesen');
        aloud.title = label;
        aloud.setAttribute('aria-label', label);
        aloud.setAttribute('aria-pressed', reading ? 'true' : 'false');
        aloud.replaceChildren(icon(reading ? 'stop' : 'speaker'));
    }
    function stopReading(cancel = true) {
        if (readTimer) clearInterval(readTimer);
        readTimer = null;
        if (reading && cancel && 'speechSynthesis' in window) speechSynthesis.cancel();
        reading = false;
        syncAloud();
    }
    reader._stopReading = () => stopReading();
    syncAloud();
    head.appendChild(aloud);
    reader.appendChild(head);

    // --- Story text ---
    const scroll = document.createElement('div');
    scroll.className = 'story-reader-scroll';
    scroll.tabIndex = -1;
    const page = document.createElement('div');
    page.className = 'story-reader-page';

    const h1 = document.createElement('h1');
    h1.className = 'story-reader-title';
    h1.textContent = title;
    page.appendChild(h1);

    const legend = document.createElement('div');
    legend.className = 'story-reader-legend';
    const hasPlay = beats.some(b => b.play);
    if (hasPlay) {
        const item = document.createElement('span');
        item.innerHTML = '<span class="story-reader-dot" aria-hidden="true"></span>kommt gleich im Spiel';
        legend.appendChild(item);
    }
    const tapItem = document.createElement('span');
    tapItem.innerHTML = '<span class="story-reader-dotted" aria-hidden="true"></span>antippen = Bedeutung';
    legend.appendChild(tapItem);
    page.appendChild(legend);

    let activeWord = null;
    const wordBar = document.createElement('div');
    wordBar.className = 'story-reader-word';
    wordBar.setAttribute('role', 'status');
    wordBar.hidden = true;
    const closeWord = () => {
        if (activeWord) activeWord.classList.remove('gloss-word-active');
        activeWord = null;
        wordBar.hidden = true;
        wordBar.replaceChildren();
    };
    const showWord = (wordEl, entry) => {
        if (activeWord === wordEl) { closeWord(); return; }
        closeWord();
        activeWord = wordEl;
        wordEl.classList.add('gloss-word-active');
        const txt = document.createElement('div');
        txt.className = 'story-reader-word-text';
        const de = document.createElement('span');
        de.className = 'story-reader-word-de';
        de.textContent = entry.de;
        const en = document.createElement('span');
        en.className = 'story-reader-word-en';
        en.textContent = entry.en;
        txt.append(de, en);
        wordBar.appendChild(txt);
        if (speechUsable()) {
            const say = iconButton('speakerSmall', 'Aussprechen', 'story-reader-word-say',
                () => { stopReading(); gameSounds.speak(speakableForm(entry.de)); });
            wordBar.appendChild(say);
        }
        wordBar.appendChild(iconButton('close', 'Schließen', 'story-reader-word-close', closeWord));
        wordBar.hidden = false;
    };

    for (const para of readerParagraphs(beats)) {
        const p = document.createElement('p');
        p.className = 'story-reader-para';
        para.forEach((beat, i) => {
            if (beat.speaker) {
                const who = document.createElement('span');
                who.className = 'story-reader-speaker';
                who.textContent = beat.speaker + ':';
                p.append(who, ' ');
            }
            if (i > 0) p.append(' ');
            const text = document.createElement('span');
            text.className = beat.play ? 'story-reader-text story-reader-play' : 'story-reader-text';
            renderGlossedText(text, beat.read || beat.play || '', glossary, showWord);
            if (beat.play && text.lastChild) {
                // The dot sticks to the last word/punctuation (no line break before it)
                const tail = document.createElement('span');
                tail.className = 'story-reader-tail';
                text.appendChild(tail);
                tail.appendChild(tail.previousSibling);
                const dot = document.createElement('span');
                dot.className = 'story-reader-dot';
                dot.setAttribute('aria-hidden', 'true');
                tail.appendChild(dot);
            }
            p.appendChild(text);
        });
        page.appendChild(p);
    }

    if (onNext) {
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'story-reader-next';
        next.append('Weiterlesen: nächstes Kapitel', icon('next', 18));
        next.addEventListener('click', () => onNext());
        page.appendChild(next);
    }

    scroll.appendChild(page);
    reader.appendChild(scroll);

    // --- Bottom: word meaning + "Jetzt spielen" ---
    const foot = document.createElement('div');
    foot.className = 'story-reader-foot';
    const footInner = document.createElement('div');
    footInner.className = 'story-reader-foot-inner';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'story-reader-play-btn';
    play.append('Jetzt spielen', playIcon());
    play.addEventListener('click', () => {
        hideStoryReader();
        onPlay();
    });
    footInner.append(wordBar, play);
    foot.appendChild(footInner);
    reader.appendChild(foot);
    document.body.appendChild(reader);

    const updateProgress = () => {
        const f = readProgress(scroll.scrollTop, scroll.clientHeight, scroll.scrollHeight);
        fill.style.width = `${Math.round(f * 100)}%`;
        bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    };
    scroll.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // Window capture runs before the narration card's and the game's document
    // handlers, so no key reaches them while the reader is open
    reader._onKey = (e) => {
        if (e.ctrlKey || e.metaKey) return;
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            if (activeWord) closeWord();
            else close();
        } else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList &&
                   e.target.classList.contains('gloss-word')) {
            e.preventDefault();
            e.target.click();
        }
    };
    window.addEventListener('keydown', reader._onKey, true);
    scroll.focus();
}
