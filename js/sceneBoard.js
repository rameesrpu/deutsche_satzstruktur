// sceneBoard: the preposition-scene board kind (Wo? Wohin?). A hen walks to a place (Wohin? Akkusativ)
// or sits at one (Wo? Dativ). First the pure part: sentences, article blank, preposition options, what the
// scene plays. The DOM part (bottom) draws the four modes and registers the kind 'scene'.

import { registerKind } from './boards.js';
import { parseNoun, nearestSpot, tapPercent } from './hotspotBoard.js';
import { articleFor } from './gameRules.js';

export const PREPS = ['in', 'an', 'auf', 'unter', 'über', 'vor', 'hinter', 'neben', 'zwischen'];

const GENDER_KEY = { masc: 'm', fem: 'f', neut: 'n', pl: 'pl' };
const CONTRACTED = { 'in dem': 'im', 'in das': 'ins', 'an dem': 'am', 'an das': 'ans' };
const CASE = { wohin: 'akk', wo: 'dat' };

const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "wohin"/"wo" ids: `<item id>.wohin`. Every item has a Wohin? id; a Wo? id only with a `wo` verb. */
export function sceneItemIds(set) {
    return set.items.flatMap(it => [`${it.id}.wohin`, ...(it.verbs.wo ? [`${it.id}.wo`] : [])]);
}

/** Dative plural adds -n unless the noun ends in -n or -s. */
function nounForm(n, caseName) {
    if (n.gender === 'pl') {
        const pl = n.plural || n.noun;
        return caseName === 'dat' && !/[ns]$/.test(pl) ? pl + 'n' : pl;
    }
    return n.noun;
}

function parts(set, itemId) {
    const [id, kind] = itemId.split('.');
    const item = set.items.find(i => i.id === id);
    if (!item || !CASE[kind] || (kind === 'wo' && !item.verbs.wo)) throw new Error(`sceneSentence: no such item ${itemId}`);
    return { item, kind, caseName: CASE[kind] };
}

/** One landmark in a case: its article and noun. */
function landmarkIn(set, key, caseName) {
    const n = parseNoun(set.landmarks[key].de);
    return { article: articleFor(GENDER_KEY[n.gender], caseName), noun: nounForm(n, caseName) };
}

/** The article slot (preposition included when either case contracts) and the words after it, for one case. */
function slot(set, item, caseName) {
    const a = landmarkIn(set, item.landmark, caseName);
    if (item.landmark2) {
        const b = landmarkIn(set, item.landmark2, caseName);
        return { prepInSlot: false, slot: `${a.article} … ${b.article}`, a, b };
    }
    const contracts = ['akk', 'dat'].some(c => CONTRACTED[`${item.prep} ${landmarkIn(set, item.landmark, c).article}`]);
    const word = contracts
        ? (CONTRACTED[`${item.prep} ${a.article}`] || `${item.prep} ${a.article}`)
        : a.article;
    return { prepInSlot: contracts, slot: word, a };
}

/**
 * @param {Object} set
 * @param {string} itemId  `<item id>.wohin` or `.wo`
 */
export function sceneSentence(set, itemId) {
    const { item, kind, caseName } = parts(set, itemId);
    const other = caseName === 'akk' ? 'dat' : 'akk';
    const mine = slot(set, item, caseName);
    const theirs = slot(set, item, other);
    const verb = item.verbs[kind];
    let phrase;
    if (item.landmark2) {
        phrase = `${item.prep} ${mine.a.article} ${mine.a.noun} und ${mine.b.article} ${mine.b.noun}`;
    } else if (mine.prepInSlot) {
        phrase = `${mine.slot} ${mine.a.noun}`;
    } else {
        phrase = `${item.prep} ${mine.a.article} ${mine.a.noun}`;
    }
    const mover = parseNoun(set.mover.de);
    return {
        kind, case: caseName,
        text: `${capital(`${mover.article} ${mover.noun}`)} ${verb} ${phrase}.`,
        verb, prep: item.prep, phrase,
        answer: mine.slot, other: theirs.slot,
    };
}

/**
 * The sentence with its article slot cut out. `options`: Akkusativ form first, Dativ second.
 * Contracted (either case): the slot is the whole word(s) "ins" / "an den", so `before` has no preposition.
 * Two landmarks: `after` is the template `{1} Baum und {2} Bank.` and each option carries both articles.
 */
export function articleBlank(set, itemId) {
    const { item, kind, caseName } = parts(set, itemId);
    const s = sceneSentence(set, itemId);
    const akk = slot(set, item, 'akk');
    const dat = slot(set, item, 'dat');
    const mover = parseNoun(set.mover.de);
    const head = `${capital(`${mover.article} ${mover.noun}`)} ${s.verb} `;
    const options = [akk.slot, dat.slot];
    const answer = caseName === 'akk' ? akk.slot : dat.slot;
    if (item.landmark2) {
        return { before: `${head}${item.prep} `, after: `{1} ${akk.a.noun} und {2} ${akk.b.noun}.`, options, answer };
    }
    return {
        before: akk.prepInSlot ? head : `${head}${item.prep} `,
        after: ` ${akk.a.noun}.`, options, answer,
    };
}

/** Four of PREPS including the item's, shuffled. */
export function prepOptions(itemId, rng = Math.random) {
    const key = itemId.split('.')[0].split('-')[0];
    const prep = key === 'ueber' ? 'über' : key;
    const pool = PREPS.filter(p => p !== prep);
    const picked = [prep];
    while (picked.length < 4) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    for (let i = picked.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked;
}

export const ruleHint = kind => (kind === 'wohin' ? 'Wohin? → Akkusativ' : 'Wo? → Dativ');

/** The kind's practice ids for the scored modes. */
export const itemIds = set => sceneItemIds(set);

/** The garden is 400×300 units (the hen is 8 % of its width, set in CSS). */
const GARDEN = [400, 300];

/**
 * What the scene plays for `<item id>.wohin|wo`: a walk from `from` (the hen's home) to `to`, or `from: null`
 * for a rest at `to`. Spots are the hen's feet, percent of the garden. `front`: the landmark's front rect of a
 * hinter item (percent [x, y, w, h]), else null.
 */
export function sceneAction(set, itemId) {
    const { item, kind } = parts(set, itemId);
    return {
        kind, item, to: item.spot,
        from: kind === 'wohin' ? set.mover.home : null,
        front: item.prep === 'hinter' ? (set.landmarks[item.landmark].front || null) : null,
    };
}

/** CSS clip-path for the occluding copy of the garden: the front rect, grown by 1 px on every side. */
export function frontClip([x, y, w, h]) {
    const n = v => `${+v.toFixed(3)}%`;
    return `inset(calc(${n(y)} - 1px) calc(${n(100 - x - w)} - 1px) calc(${n(100 - y - h)} - 1px) calc(${n(x)} - 1px))`;
}

/**
 * The arrow of a walk in garden units (viewBox 0 0 400 300): the shaft stops at the head's base.
 * @returns {?{x1: number, y1: number, x2: number, y2: number, head: string}} null when the walk is too short
 */
export function arrowGeometry(from, to, headLen = 14, headHalf = 7) {
    const x1 = from[0] / 100 * GARDEN[0], y1 = from[1] / 100 * GARDEN[1];
    const tx = to[0] / 100 * GARDEN[0], ty = to[1] / 100 * GARDEN[1];
    const len = Math.hypot(tx - x1, ty - y1);
    if (len < headLen * 1.5) return null;
    const ux = (tx - x1) / len, uy = (ty - y1) / len;
    const bx = tx - ux * headLen, by = ty - uy * headLen;
    const r = n => Math.round(n * 10) / 10;
    return {
        x1: r(x1), y1: r(y1), x2: r(bx), y2: r(by),
        head: `${r(tx)},${r(ty)} ${r(bx - uy * headHalf)},${r(by + ux * headHalf)} ${r(bx + uy * headHalf)},${r(by - ux * headHalf)}`,
    };
}

/**
 * The sentence as display segments `{kind: 'text'|'bold'|'blank'|'pending', text}`.
 * No `fill`: the article slot is a blank (contracted: the whole "ins" / "an den"). `fill` = a slot string
 * (e.g. `ins`, `den … die`): it is set in bold in place of the blank. `prepBlank` (Satz, first step): the
 * preposition is a blank too and the article slot a `pending` "___".
 */
export function sentenceSegments(set, itemId, { prepBlank = false, fill = null } = {}) {
    const { item } = parts(set, itemId);
    const b = articleBlank(set, itemId);
    const out = [];
    const text = t => { if (t) out.push({ kind: 'text', text: t }); };
    const slotCount = { n: 0 };
    const article = () => {
        const fills = fill === null ? null : fill.split(' … ');
        const i = slotCount.n++;
        if (prepBlank) out.push({ kind: 'pending', text: '___' });
        else if (fills) out.push({ kind: 'bold', text: fills.length > 1 ? fills[i] : fill });
        else out.push({ kind: 'blank', text: '___' });
    };
    const rest = tpl => tpl.split(/(\{\d\})/).forEach(piece => (/^\{\d\}$/.test(piece) ? article() : text(piece)));
    const prepInBefore = b.before.endsWith(`${item.prep} `);
    if (prepBlank) {
        text(prepInBefore ? b.before.slice(0, -(item.prep.length + 1)) : b.before);
        out.push({ kind: 'blank', text: '___' });
        text(' ');
    } else {
        text(b.before);
    }
    if (b.after.includes('{1}')) rest(b.after);
    else { article(); text(b.after); }
    return out;
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
const shuffled = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const WALK_MS = 900;

/** Segments to DOM: bold article, blanks as underscores. */
function drawSegments(segs) {
    const box = el('span', 'sc-text');
    for (const s of segs) {
        if (s.kind === 'bold') box.append(el('b', '', s.text));
        else if (s.kind === 'blank' || s.kind === 'pending') box.append(el('span', `sc-blank${s.kind === 'pending' ? ' is-pending' : ''}`, s.text));
        else box.append(s.text);
    }
    return box;
}

/**
 * The garden with the hen. `walk(action, onEnd)` plays a movement (arrow + 900 ms walk, or a jump with reduced
 * motion), `rest(action)` puts the hen at the spot with a dot. A new call cuts the running one cleanly.
 */
function drawScene(ctx) {
    const set = ctx.set;
    const wrap = el('div', 'sc-pic');
    const garden = (cls) => {
        const img = el('img', cls);
        img.src = `data/boards/${set.image}?v=${ctx.board.version}`;
        img.alt = '';
        img.draggable = false;
        return img;
    };
    const base = garden('sc-img');
    const hen = el('img', 'sc-hen');
    hen.src = `data/boards/${set.mover.image}?v=${ctx.board.version}`;
    hen.alt = '';
    hen.draggable = false;
    const front = garden('sc-img sc-front');
    front.hidden = true;
    const arrow = svgEl('svg', { class: 'sc-arrow', viewBox: '0 0 400 300', 'aria-hidden': 'true' });
    const restDot = el('span', 'hs-dot sc-rest');
    restDot.hidden = true;
    const quiet = new Map();
    wrap.append(base);
    for (const it of ctx.items) {
        const d = el('span', 'hs-dot is-quiet');
        d.style.left = `${it.spot[0]}%`;
        d.style.top = `${it.spot[1]}%`;
        d.hidden = true;
        quiet.set(it.id, d);
        wrap.append(d);
    }
    wrap.append(hen, front, arrow, restDot);

    let timer = null;
    let anim = null;
    let facing = 1;
    const place = (spot, flip) => {
        hen.style.left = `${spot[0]}%`;
        hen.style.top = `${spot[1]}%`;
        hen.style.transform = `translate(-50%, -100%) scaleX(${flip})`;
    };
    const stop = () => {
        clearTimeout(timer);
        timer = null;
        if (anim) { anim.cancel(); anim = null; }
    };
    const setFront = rect => {
        front.hidden = !rect;
        if (rect) front.style.clipPath = frontClip(rect);
    };
    const clearMarks = () => {
        arrow.replaceChildren();
        restDot.hidden = true;
        setFront(null);
    };
    place(set.mover.home, facing);
    return {
        wrap,
        showSpots(on) { for (const d of quiet.values()) d.hidden = !on; },
        /** The quiet dot of the item being played is hidden (the hen stands there). */
        mark(id) { for (const [k, d] of quiet) d.classList.toggle('is-covered', k === id); },
        percentOf: e => tapPercent(wrap.getBoundingClientRect(), e.clientX, e.clientY),
        /** The hen back at its home, nothing marked. */
        reset() { stop(); clearMarks(); place(set.mover.home, facing); },
        /** The wrong tap of Verstehen. */
        wrongDot(spot) {
            const d = el('span', 'hs-dot is-wrong');
            d.style.left = `${spot[0]}%`;
            d.style.top = `${spot[1]}%`;
            wrap.append(d);
        },
        walk(action, onEnd) {
            stop();
            clearMarks();
            setFront(action.front);
            const g = arrowGeometry(action.from, action.to);
            if (g) {
                arrow.append(
                    svgEl('line', { class: 'sc-arrow-line', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 }),
                    svgEl('polygon', { class: 'sc-arrow-head', points: g.head }),
                );
            }
            if (action.to[0] !== action.from[0]) facing = action.to[0] > action.from[0] ? 1 : -1;
            const duration = reducedMotion() ? 0 : WALK_MS;
            place(action.from, facing);
            hen.getBoundingClientRect(); // commit the start before the keyframes
            place(action.to, facing);
            if (duration && typeof hen.animate === 'function') {
                const t = `translate(-50%, -100%) scaleX(${facing})`;
                anim = hen.animate([
                    { left: `${action.from[0]}%`, top: `${action.from[1]}%`, transform: t },
                    { left: `${action.to[0]}%`, top: `${action.to[1]}%`, transform: t },
                ], { duration, easing: 'ease-in-out' });
            }
            timer = setTimeout(() => { timer = null; anim = null; onEnd(); }, duration);
        },
        rest(action) {
            stop();
            clearMarks();
            setFront(action.front);
            place(action.to, facing);
            restDot.style.left = `${action.to[0]}%`;
            restDot.style.top = `${action.to[1]}%`;
            restDot.hidden = false;
        },
        destroy: stop,
    };
}

/** Plays an item's scene (walk for Wohin?, rest for Wo?); `onEnd` when it is over. */
function play(scene, action, onEnd) {
    if (action.from) scene.walk(action, onEnd);
    else { scene.rest(action); onEnd(); }
}

/** Sentence line with a 🔊 button; `show(segs, speech)` fills it. */
function drawSentenceLine(ctx) {
    const line = el('div', 'hs-prompt sc-sentence');
    const text = el('span', 'hs-prompt-text');
    text.lang = 'de';
    const say = el('button', 'hs-say', '🔊');
    say.type = 'button';
    say.setAttribute('aria-label', 'Vorlesen');
    say.hidden = true;
    let speech = '';
    say.addEventListener('click', () => ctx.say(speech));
    line.append(text, say);
    return {
        line,
        show(segs, speak) {
            text.replaceChildren(drawSegments(segs));
            speech = speak;
            say.hidden = !speak;
        },
    };
}

const optionButtons = (labels, onPick) => {
    const row = el('div', 'hs-options sc-options');
    const buttons = labels.map(label => {
        const b = btn('hs-option', label, () => onPick(label, b));
        b.lang = 'de';
        b.disabled = true;
        return b;
    });
    row.append(...buttons);
    return { row, buttons, enable() { buttons.forEach(b => { b.disabled = false; }); }, lock() { buttons.forEach(b => { b.disabled = true; }); } };
};

function renderEntdecken(root, ctx) {
    const scene = drawScene(ctx);
    const sentence = drawSentenceLine(ctx);
    const hint = el('p', 'hs-hint sc-rule');
    hint.setAttribute('aria-live', 'polite');
    const next = el('div', 'play-continue-row sc-next');
    next.hidden = true;
    let moving = false;
    let dead = false;
    scene.showSpots(true);
    const showItem = (item, kind) => {
        const id = `${item.id}.${kind}`;
        const s = sceneSentence(ctx.set, id);
        sentence.show(sentenceSegments(ctx.set, id, { fill: s.answer }), s.text);
        hint.textContent = ruleHint(kind);
        ctx.speak(s.text);
        return id;
    };
    const onTap = e => {
        if (moving || dead) return;
        const spot = scene.percentOf(e);
        const id = nearestSpot(ctx.items, ...spot);
        next.hidden = true;
        next.replaceChildren();
        if (!id) { hint.textContent = 'Tipp auf einen Punkt.'; return; }
        const item = ctx.items.find(i => i.id === id);
        scene.reset();
        scene.mark(id);
        moving = true;
        const wohinId = showItem(item, 'wohin');
        scene.walk(sceneAction(ctx.set, wohinId), () => {
            if (dead) return;
            moving = false;
            if (!item.verbs.wo) return;
            next.append(btn('play-continue', 'Weiter ›', () => {
                next.hidden = true;
                next.replaceChildren();
                const woId = showItem(item, 'wo');
                scene.rest(sceneAction(ctx.set, woId));
            }));
            next.hidden = false;
        });
    };
    scene.wrap.classList.add('is-tappable');
    scene.wrap.addEventListener('click', onTap);
    root.replaceChildren(scene.wrap, sentence.line, hint, next);
    return () => { dead = true; scene.destroy(); };
}

function renderVerstehen(root, ctx) {
    const [id] = ctx.itemId.split('.');
    const item = ctx.items.find(i => i.id === id);
    const scene = drawScene(ctx);
    const sentence = drawSentenceLine(ctx);
    const hint = el('p', 'hs-hint sc-rule');
    hint.setAttribute('aria-live', 'polite');
    const s = sceneSentence(ctx.set, ctx.itemId);
    let busy = false;
    let dead = false;
    sentence.show(sentenceSegments(ctx.set, ctx.itemId, { fill: s.answer }), s.text);
    scene.showSpots(true);
    scene.wrap.classList.add('is-tappable');
    scene.wrap.addEventListener('click', e => {
        if (busy || dead) return;
        const tapped = nearestSpot(ctx.items, ...scene.percentOf(e));
        if (!tapped) { hint.textContent = 'Tipp auf einen Punkt.'; return; }
        busy = true;
        scene.wrap.classList.remove('is-tappable');
        hint.textContent = '';
        const ok = tapped === item.id;
        if (!ok) scene.wrongDot(ctx.items.find(i => i.id === tapped).spot);
        scene.mark(item.id);
        play(scene, sceneAction(ctx.set, ctx.itemId), () => {
            if (dead) return;
            hint.textContent = ruleHint(s.kind);
            ctx.onAnswer(ok);
        });
    });
    root.replaceChildren(scene.wrap, sentence.line, hint);
    ctx.speak(s.text);
    return () => { dead = true; scene.destroy(); };
}

/** artikel / satz: the scene plays, then the blanks are answered. satz asks the preposition first. */
function renderBlanks(root, ctx, withPrep) {
    const [id] = ctx.itemId.split('.');
    const item = ctx.items.find(i => i.id === id);
    const scene = drawScene(ctx);
    const sentence = drawSentenceLine(ctx);
    const hint = el('p', 'hs-hint sc-rule');
    hint.setAttribute('aria-live', 'polite');
    const choices = el('div', 'sc-choices');
    const s = sceneSentence(ctx.set, ctx.itemId);
    const blank = articleBlank(ctx.set, ctx.itemId);
    let dead = false;
    let prepOk = true;
    let timer = null;

    const finish = ok => {
        sentence.show(sentenceSegments(ctx.set, ctx.itemId, { fill: s.answer }), s.text);
        hint.textContent = ruleHint(s.kind);
        ctx.speak(s.text);
        ctx.onAnswer(ok);
    };
    const articleStep = () => {
        sentence.show(sentenceSegments(ctx.set, ctx.itemId), '');
        const opts = optionButtons(shuffled(blank.options), (label, b) => {
            opts.lock();
            const right = label === blank.answer;
            b.classList.add(right ? 'is-right' : 'is-wrong');
            opts.buttons.find(x => x.textContent === blank.answer).classList.add('is-right');
            finish(right && prepOk);
        });
        choices.append(opts.row);
        opts.enable();
    };
    const prepStep = () => {
        sentence.show(sentenceSegments(ctx.set, ctx.itemId, { prepBlank: true }), '');
        const opts = optionButtons(prepOptions(ctx.itemId), (label, b) => {
            opts.lock();
            prepOk = label === item.prep;
            b.classList.add(prepOk ? 'is-right' : 'is-wrong');
            opts.buttons.find(x => x.textContent === item.prep).classList.add('is-right');
            articleStep();
        });
        choices.append(opts.row);
        opts.enable();
    };

    sentence.show(sentenceSegments(ctx.set, ctx.itemId, { prepBlank: withPrep }), '');
    root.replaceChildren(scene.wrap, sentence.line, hint, choices);
    scene.mark(item.id);
    // a short beat so the learner sees the hen's home before it walks
    timer = setTimeout(() => {
        play(scene, sceneAction(ctx.set, ctx.itemId), () => {
            if (dead) return;
            if (withPrep) prepStep(); else articleStep();
        });
    }, 300);
    return () => { dead = true; clearTimeout(timer); scene.destroy(); };
}

registerKind('scene', {
    renderSet(root, ctx) {
        if (ctx.mode === 'entdecken') return renderEntdecken(root, ctx);
        if (ctx.mode === 'verstehen') return renderVerstehen(root, ctx);
        return renderBlanks(root, ctx, ctx.mode === 'satz');
    },
    itemIds: (set, modeId) => sceneItemIds(set),
});
