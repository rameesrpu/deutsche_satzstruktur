// Story reader: a full-screen page showing one chapter as a story (all beats in
// order) before it is played. Glossary words are tappable (glossary.js); the
// play sentences are marked, since those are the ones placed in game mode.

import { storyLineElement } from './storyNarration.js';
import { closeGlossPopover } from './glossary.js';

const READER_ID = 'story-reader';

/** @returns {boolean} */
export function isStoryReaderOpen() {
    return !!document.getElementById(READER_ID);
}

/** Remove the reader (no onClose: that is only for the reader's own ✕ / Esc). */
export function hideStoryReader() {
    closeGlossPopover();
    const el = document.getElementById(READER_ID);
    if (el) {
        window.removeEventListener('keydown', el._onKey, true);
        el.remove();
    }
}

function button(label, className, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
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
 * @param {?Function} [opts.onClose]      after the reader is closed with ✕ or Esc
 */
export function showStoryReader({ heading, subheading = null, beats, glossary = {}, onPlay, onNext = null, onClose = null }) {
    hideStoryReader();
    const close = () => {
        hideStoryReader();
        if (onClose) onClose();
    };

    const reader = document.createElement('div');
    reader.id = READER_ID;
    reader.className = 'story-reader';
    reader.setAttribute('role', 'dialog');
    reader.setAttribute('aria-label', heading);

    const head = document.createElement('div');
    head.className = 'story-reader-head';
    const titles = document.createElement('div');
    titles.className = 'story-reader-titles';
    if (subheading) {
        const sub = document.createElement('div');
        sub.className = 'story-reader-sub';
        sub.textContent = subheading;
        titles.appendChild(sub);
    }
    const title = document.createElement('div');
    title.className = 'story-reader-title';
    title.textContent = heading;
    titles.appendChild(title);
    head.appendChild(titles);
    const closeBtn = button('✕', 'story-reader-close', close);
    closeBtn.title = 'Schließen';
    head.appendChild(closeBtn);
    reader.appendChild(head);

    const scroll = document.createElement('div');
    scroll.className = 'story-reader-scroll';
    scroll.tabIndex = -1;
    const page = document.createElement('div');
    page.className = 'story-reader-page';

    const hint = document.createElement('div');
    hint.className = 'story-reader-hint';
    hint.textContent = 'Tippe auf ein unterstrichenes Wort: Bedeutung und Aussprache. ' +
        'Die markierten Sätze spielst du danach.';
    page.appendChild(hint);

    beats.forEach(beat => {
        page.appendChild(storyLineElement(beat, beat.play ? ' story-reader-play' : '', glossary));
    });

    const actions = document.createElement('div');
    actions.className = 'story-reader-actions';
    actions.appendChild(button('Jetzt spielen ▶', 'story-btn story-btn-primary', () => {
        hideStoryReader();
        onPlay();
    }));
    if (onNext) actions.appendChild(button('Weiterlesen ▶', 'story-btn', () => onNext()));
    page.appendChild(actions);

    scroll.appendChild(page);
    reader.appendChild(scroll);
    document.body.appendChild(reader);

    // Window capture runs before the narration card's and the game's document
    // handlers, so no key reaches them while the reader is open
    reader._onKey = (e) => {
        if (e.ctrlKey || e.metaKey) return;
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            if (document.getElementById('gloss-popover')) closeGlossPopover();
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
