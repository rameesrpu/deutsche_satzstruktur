// timelineBoard: the time board kind (Die Zeit). A verb is placed on a timeline (Gestern / Jetzt / Morgen),
// completed into the Perfekt bracket (Klammer) and sorted by auxiliary (haben oder sein?).
// The top of this file is the pure part: sentences, bracket frame, hints, practice ids, hit test, clamp
// geometry. The DOM part (bottom) draws the three modes and registers the kind 'timeline'.

import { registerKind } from './boards.js';

export const AUX = {
    haben: { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt' },
    sein: { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid' },
};

export const ZONES = ['past', 'now', 'future'];

const join = (...parts) => parts.filter(p => p).join(' ');
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

/** One sentence of a verb in a time zone: Gestern + Perfekt, Jetzt / Morgen + Präsens (verb second). */
export function timeSentence(verb, zone) {
    if (zone === 'past') return join('Gestern', AUX[verb.aux][verb.person], verb.subject, verb.rest, verb.partizip) + '.';
    const lead = zone === 'future' ? 'Morgen' : 'Jetzt';
    return join(lead, verb.finite, verb.subject, verb.rest, verb.particle) + '.';
}

/** Practice ids of a mode: wann has one per verb and zone (`<id>.past|now|future`, zones rotated per verb), the others one per verb. */
export function timelineItemIds(set, modeId) {
    if (modeId !== 'wann') return set.items.map(v => v.id);
    // three passes; the zone rotates per verb (verb i, pass p: zone (i + p) mod 3), so the order gives nothing away
    return [0, 1, 2].flatMap(p => set.items.map((v, i) => `${v.id}.${ZONES[(i + p) % 3]}`));
}

/** The Perfekt sentence in the bracket order: Subject, auxiliary, "gestern ...", participle. */
export function clampSentence(verb) {
    return join(capital(verb.subject), AUX[verb.aux][verb.person], 'gestern', verb.rest, verb.partizip) + '.';
}

function shuffled(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** What the Klammer exercise shows: the text before the bracket, between its parts, both choices (wrong participles only here). */
export function clampFrame(verb, rng = Math.random) {
    return {
        before: capital(verb.subject),
        middle: join('gestern', verb.rest),
        auxOptions: [AUX.haben[verb.person], AUX.sein[verb.person]],
        auxAnswer: AUX[verb.aux][verb.person],
        partOptions: shuffled([verb.partizip, ...verb.wrong], rng),
        partAnswer: verb.partizip,
    };
}

/** The short rule shown after a haben-oder-sein answer. */
export function auxHint(verb) {
    if (verb.inf === 'sein' || verb.inf === 'bleiben') return 'sein und bleiben: immer mit sein';
    return verb.aux === 'sein' ? 'Bewegung oder Veränderung → sein' : 'Alle anderen → haben';
}

/** Wraps `fn` so only the first call runs (an answer is given once per item, however often a zone is hit). */
export function once(fn) {
    let done = false;
    return (...args) => {
        if (done) return undefined;
        done = true;
        return fn(...args);
    };
}

/** The zone whose rect `{left, top, right, bottom}` contains the point, or null (a drop outside every zone does nothing). */
export function zoneAt(rects, x, y) {
    for (const [zone, r] of Object.entries(rects)) {
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return zone;
    }
    return null;
}

/**
 * The clamp of Klammer as two path strings (SVG units = px of the sentence box). `a`, `b`: top centre of the two gaps.
 * One bar above the sentence joins the arms; while open the bar has a break in the middle, closed it is one line and
 * sits a little lower. Gaps on different lines: the bar runs on to the right margin and comes back between the lines.
 */
export function clampGeometry(a, b, width, open) {
    const g = open ? 10 : 0;
    const barY = open ? 4 : 9;
    const arm = p => `${p.x},${p.y}`;
    if (Math.abs(a.y - b.y) < 8) {
        const mid = (a.x + b.x) / 2;
        return [
            `M${arm(a)} L${a.x},${barY} L${mid - g},${barY}`,
            `M${mid + g},${barY} L${b.x},${barY} L${arm(b)}`,
        ];
    }
    const xr = width - 6;
    const mid = (a.x + xr) / 2;
    const back = b.y - 7;
    return [
        `M${arm(a)} L${a.x},${barY} L${mid - g},${barY}`,
        `M${mid + g},${barY} L${xr},${barY} L${xr},${back} L${b.x},${back} L${arm(b)}`,
    ];
}

// ---- DOM part ----

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};
const btn = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
};
const svgEl = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
};

const ZONE_LABEL = { past: 'Vergangenheit', now: 'Jetzt', future: 'Zukunft' };
const FUTURE_HINT = 'Morgen + Präsens = Zukunft';

/** A sentence card: the text and a 🔊 button (a deliberate tap always speaks). */
function sentenceCard(ctx, cls) {
    const card = el('div', `tl-card ${cls || ''}`.trim());
    const text = el('span', 'tl-card-text');
    text.lang = 'de';
    const say = el('button', 'hs-say', '🔊');
    say.type = 'button';
    say.setAttribute('aria-label', 'Vorlesen');
    let speech = '';
    say.addEventListener('click', () => ctx.say(speech));
    card.append(text, say);
    return {
        card,
        show(t) { text.textContent = t; speech = t; },
    };
}

function hintLine() {
    const hint = el('p', 'hs-hint tl-hint');
    hint.setAttribute('aria-live', 'polite');
    return hint;
}

/** wann: the card goes to Vergangenheit / Jetzt / Zukunft by tap on a zone or by dragging the card onto it. */
function renderWann(root, ctx) {
    const [id, zone] = ctx.itemId.split('.');
    const verb = ctx.items.find(v => v.id === id);
    const text = timeSentence(verb, zone);
    const { card, show } = sentenceCard(ctx, 'tl-drag');
    show(text);
    const hint = hintLine();
    const line = el('div', 'tl-line');
    const zones = {};
    for (const z of ZONES) {
        const b = el('button', `tl-zone tl-zone--${z}`);
        b.type = 'button';
        b.append(el('span', 'tl-zone-label', ZONE_LABEL[z]), el('span', 'tl-zone-slot'));
        if (z === 'now') b.append(el('span', 'tl-dot'));
        zones[z] = b;
        line.append(b);
    }
    const home = el('div', 'tl-card-home');
    home.append(card);

    let dead = false;
    let answered = false;
    const choose = once(picked => {
        if (dead) return;
        answered = true;
        drag = null;
        const ok = picked === zone;
        for (const b of Object.values(zones)) b.disabled = true;
        card.classList.remove('is-dragging');
        card.style.transform = '';
        if (ok) {
            zones[zone].classList.add('is-right');
            zones[zone].querySelector('.tl-zone-slot').append(card);
            card.classList.add('is-settled');
        } else {
            zones[picked].classList.add('is-wrong');
            zones[zone].classList.add('is-pulse');
            card.classList.add('is-bounce');
        }
        if (zone === 'future') hint.textContent = FUTURE_HINT;
        ctx.onAnswer(ok);
    });
    for (const z of ZONES) zones[z].addEventListener('click', () => choose(z));

    // drag the card onto a zone (pointer events); a release outside every zone snaps back and does nothing
    let drag = null;
    card.addEventListener('pointerdown', e => {
        if (dead || answered || e.target.closest('button') || drag) return;
        drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
        if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        card.classList.add('is-dragging');
        card.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const release = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = drag.moved;
        drag = null;
        card.classList.remove('is-dragging');
        card.style.transform = '';
        if (!moved || e.type !== 'pointerup') return;
        const rects = {};
        for (const z of ZONES) rects[z] = zones[z].getBoundingClientRect();
        const hit = zoneAt(rects, e.clientX, e.clientY);
        if (hit) choose(hit);
    };
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
    card.addEventListener('lostpointercapture', release);

    root.replaceChildren(home, line, hint);
    ctx.speak(text);
    return () => { dead = true; };
}

/** klammer: fill the two gaps of "Sie [ ? ] gestern ... [ ? ]." (helper verb, then participle); the clamp closes. */
function renderKlammer(root, ctx) {
    const verb = ctx.items.find(v => v.id === ctx.itemId);
    const frame = clampFrame(verb);
    const box = el('div', 'tl-frame');
    box.lang = 'de';
    const svg = svgEl('svg', { class: 'tl-clamp', 'aria-hidden': 'true' });
    const barA = svgEl('path', { class: 'tl-clamp-arm' });
    const barB = svgEl('path', { class: 'tl-clamp-arm' });
    svg.append(barA, barB);
    const emptyGap = () => {
        const g = el('span', 'tl-gap', '?');
        g.setAttribute('aria-label', 'Lücke');
        return g;
    };
    const gap1 = emptyGap();
    const gap2 = emptyGap();
    const words = el('span', 'tl-frame-text');
    const tail = el('span', 'tl-nowrap');   // the full stop never wraps alone
    tail.append(gap2, '.');
    words.append(`${frame.before} `, gap1, ` ${frame.middle} `, tail);
    box.append(svg, words);
    const hint = hintLine();
    const choices = el('div', 'sc-choices');
    const closing = el('div', 'tl-closing');
    closing.hidden = true;

    let dead = false;
    let closed = false;
    const layout = () => {
        const w = box.clientWidth;
        if (!w) return;
        const r = box.getBoundingClientRect();
        const top = g => {
            const gr = g.getBoundingClientRect();
            return { x: Math.round(gr.left - r.left + gr.width / 2), y: Math.round(gr.top - r.top) - 2 };
        };
        const [da, db] = clampGeometry(top(gap1), top(gap2), w, !closed);
        barA.setAttribute('d', da);
        barB.setAttribute('d', db);
        svg.setAttribute('viewBox', `0 0 ${w} ${box.clientHeight}`);
    };
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    let observer = null;
    if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(layout);
        observer.observe(box);
    }

    let ok = true;
    const options = (labels, onPick) => {
        const row = el('div', 'hs-options sc-options');
        const buttons = labels.map(label => {
            const b = btn('hs-option', label, once(() => {
                if (dead) return;
                buttons.forEach(x => { x.disabled = true; });
                onPick(label, b, buttons);
            }));
            b.lang = 'de';
            return b;
        });
        row.append(...buttons);
        return row;
    };
    // the gap shows the right form; a wrong pick is marked on its button only, never put into the sentence
    const fill = (gap, label, right) => {
        gap.textContent = label;
        gap.removeAttribute('aria-label');
        gap.classList.add(right ? 'is-right' : 'is-fixed');
        layout();
    };
    const mark = (buttons, picked, answer) => {
        const right = picked.textContent === answer;
        picked.classList.add(right ? 'is-right' : 'is-wrong');
        buttons.find(x => x.textContent === answer).classList.add('is-right');
        return right;
    };
    const partStep = () => {
        choices.append(options(frame.partOptions, (label, b, buttons) => {
            const right = mark(buttons, b, frame.partAnswer);
            ok = ok && right;
            fill(gap2, frame.partAnswer, right);
            closed = true;
            box.classList.add('is-closed');
            layout();
            const sentence = clampSentence(verb);
            const { card, show } = sentenceCard(ctx, 'tl-sentence');
            show(sentence);
            closing.replaceChildren(card);
            closing.hidden = false;
            ctx.speak(sentence);
            ctx.onAnswer(ok);
        }));
    };
    const auxStep = () => {
        choices.replaceChildren(options(frame.auxOptions, (label, b, buttons) => {
            const right = mark(buttons, b, frame.auxAnswer);
            ok = ok && right;
            fill(gap1, frame.auxAnswer, right);
            if (!right) hint.textContent = auxHint(verb);
            partStep();
        }));
    };
    auxStep();

    root.replaceChildren(box, choices, closing, hint);
    layout();
    return () => {
        dead = true;
        window.removeEventListener('resize', onResize);
        if (observer) observer.disconnect();
    };
}

/** hilfsverb: sort the infinitive into the haben or the sein bin; the rule and the Perfekt sentence follow. */
function renderHilfsverb(root, ctx) {
    const verb = ctx.items.find(v => v.id === ctx.itemId);
    const card = el('div', 'tl-card tl-verb');
    const inf = el('span', 'tl-verb-inf', verb.inf);
    inf.lang = 'de';
    card.append(inf, el('span', 'tl-verb-en', verb.en));
    const bins = {};
    const row = el('div', 'tl-bins');
    for (const aux of ['haben', 'sein']) {
        const b = el('button', `tl-bin tl-bin--${aux}`);
        b.type = 'button';
        b.lang = 'de';
        b.append(el('span', 'tl-bin-label', aux));
        if (aux === 'sein') {
            const arrow = svgEl('svg', { class: 'tl-bin-arrow', viewBox: '0 0 40 12', 'aria-hidden': 'true' });
            arrow.append(
                svgEl('circle', { cx: 4, cy: 6, r: 3, class: 'tl-bin-dot' }),
                svgEl('line', { x1: 7, y1: 6, x2: 28, y2: 6, class: 'tl-bin-line' }),
                svgEl('polygon', { points: '28,2 33,6 28,10', class: 'tl-bin-head' }),
                svgEl('circle', { cx: 36, cy: 6, r: 3, class: 'tl-bin-dot' }),
            );
            b.append(arrow);
        }
        bins[aux] = b;
        row.append(b);
    }
    const hint = hintLine();
    const result = el('div', 'tl-closing');
    result.hidden = true;
    let dead = false;
    const choose = once(picked => {
        if (dead) return;
        const ok = picked === verb.aux;
        for (const b of Object.values(bins)) b.disabled = true;
        bins[picked].classList.add(ok ? 'is-right' : 'is-wrong');
        if (!ok) bins[verb.aux].classList.add('is-pulse');
        hint.textContent = auxHint(verb);
        const sentence = clampSentence(verb);
        const { card: line, show } = sentenceCard(ctx, 'tl-sentence');
        show(sentence);
        result.replaceChildren(line);
        result.hidden = false;
        ctx.speak(sentence);
        ctx.onAnswer(ok);
    });
    for (const aux of ['haben', 'sein']) bins[aux].addEventListener('click', () => choose(aux));
    root.replaceChildren(card, row, hint, result);
    return () => { dead = true; };
}

registerKind('timeline', {
    renderSet(root, ctx) {
        root.classList.add('tl-stage');
        if (ctx.mode === 'wann') return renderWann(root, ctx);
        if (ctx.mode === 'klammer') return renderKlammer(root, ctx);
        return renderHilfsverb(root, ctx);
    },
    itemIds: timelineItemIds,
});
