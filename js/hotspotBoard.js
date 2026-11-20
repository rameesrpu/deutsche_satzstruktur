// hotspotBoard: the picture-spot board kind (body map). Pure part: noun parsing, which spot a tap
// meets, naming options, pain sentence, label model. DOM part (bottom): the four modes, registered
// with boardScreen.js as kind 'hotspot'.

import { registerKind } from './boardScreen.js';
import { GRAMMAR_PALETTE } from './grammaticalConfig.js';

const GENDER = { der: 'masc', die: 'fem', das: 'neut' };

/**
 * Parse a headword: "der Fuß, Füße" / "die Haare (pl.)".
 * @param {string} de
 * @returns {{article: 'der'|'die'|'das', noun: string, plural: ?string, pluralOnly: boolean,
 *   gender: 'masc'|'fem'|'neut'|'pl'}}
 */
export function parseNoun(de) {
    const m = /^(der|die|das)\s+([^,(]+?)\s*(?:,\s*(.+?))?\s*(\(pl\.?\))?\s*$/i.exec(String(de).trim());
    if (!m) throw new Error(`parseNoun: not a headword: "${de}"`);
    const pluralOnly = Boolean(m[4]);
    return {
        article: /** @type {'der'|'die'|'das'} */ (m[1].toLowerCase()),
        noun: m[2],
        plural: pluralOnly ? null : (m[3] || null),
        pluralOnly,
        gender: pluralOnly ? 'pl' : /** @type {any} */ (GENDER[m[1].toLowerCase()]),
    };
}

/**
 * The id of the item whose spot is nearest to the tap, within maxDist percent; else null (no answer).
 * @param {import('./types.js').HotspotItem[]} items
 * @param {number} x percent of the picture width
 * @param {number} y percent of the picture height
 * @param {number} [maxDist]
 * @returns {?string}
 */
export function nearestSpot(items, x, y, maxDist = 9) {
    let best = null;
    let bestDist = Infinity;
    for (const it of items) {
        const d = Math.hypot(it.spot[0] - x, it.spot[1] - y);
        if (d < bestDist) { best = it.id; bestDist = d; }
    }
    return bestDist <= maxDist ? best : null;
}

function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Four item ids including `id` (the others from the same set), shuffled; fewer when the set is smaller.
 * @param {import('./types.js').HotspotItem[]} items
 * @param {string} id
 * @param {() => number} [rng]
 * @returns {string[]}
 */
export function nameOptions(items, id, rng = Math.random) {
    const others = shuffle(items.map(i => i.id).filter(i => i !== id), rng).slice(0, 3);
    return shuffle([id, ...others], rng);
}

/**
 * Whether the pain sentence for this item uses the plural: every second `pair` item, by its index
 * among the set's pair items (stable per set).
 * @param {import('./types.js').HotspotItem[]} items
 * @param {string} id
 * @returns {boolean}
 */
export function painUsesPlural(items, id) {
    const index = items.filter(i => i.pair).findIndex(i => i.id === id);
    return index >= 0 && index % 2 === 1;
}

/**
 * "Mein Kopf tut weh." / "Meine Schulter tut weh." / "Meine Augen tun weh.".
 * The plural is used only for plural-only items and for `pair` items when usePlural is true.
 * @param {import('./types.js').HotspotItem} item
 * @param {boolean} usePlural
 * @returns {string}
 */
export function painSentence(item, usePlural) {
    const n = parseNoun(item.de);
    if (n.pluralOnly || (item.pair && usePlural && n.plural)) {
        return `Meine ${n.plural || n.noun} tun weh.`;
    }
    return `${n.gender === 'fem' ? 'Meine' : 'Mein'} ${n.noun} tut weh.`;
}

/**
 * "Wo ist das Knie?" / "Wo sind die Haare?"
 * @param {import('./types.js').HotspotItem} item
 * @returns {string}
 */
export function whereQuestion(item) {
    const n = parseNoun(item.de);
    return `Wo ${n.pluralOnly ? 'sind' : 'ist'} ${n.article} ${n.noun}?`;
}

/**
 * A tap as percent of the picture's box, so it works at any picture size.
 * @param {{left: number, top: number, width: number, height: number}} rect
 * @param {number} clientX
 * @param {number} clientY
 * @returns {[number, number]}
 */
export function tapPercent(rect, clientX, clientY) {
    return [(clientX - rect.left) / rect.width * 100, (clientY - rect.top) / rect.height * 100];
}

/**
 * What the label under the picture shows. The plural line is absent for plural-only words.
 * @param {import('./types.js').HotspotItem} item
 * @returns {{article: string, noun: string, gender: 'masc'|'fem'|'neut'|'pl', plural: ?string, en: string, speech: string}}
 */
export function labelModel(item) {
    const n = parseNoun(item.de);
    return {
        article: n.article, noun: n.noun, gender: n.gender,
        plural: n.plural ? `Plural: die ${n.plural}` : null,
        en: item.en,
        speech: `${n.article} ${n.noun}`,
    };
}

// ---- DOM part ----

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

function drawLabel(item, ctx, colored = true) {
    const m = labelModel(item);
    const box = el('div', 'hs-label');
    const word = el('div', 'hs-label-word');
    word.lang = 'de';
    if (colored) word.style.color = GRAMMAR_PALETTE[m.gender].ink;
    word.append(el('span', 'hs-label-article', m.article), ` ${m.noun}`);
    const say = el('button', 'hs-say', '🔊');
    say.type = 'button';
    say.setAttribute('aria-label', 'Vorlesen');
    say.addEventListener('click', e => { e.stopPropagation(); ctx.speak(m.speech); });
    box.append(word, say);
    if (m.plural) box.append(el('div', 'hs-label-plural', m.plural));
    box.append(el('div', 'hs-label-en', m.en));
    return box;
}

/** Picture box (3:4) with the point layer; returns helpers. */
function drawPicture(ctx) {
    const wrap = el('div', 'hs-pic');
    const img = el('img', 'hs-img');
    img.src = `data/boards/${ctx.set.image}?v=${ctx.board.version}`;
    img.alt = '';
    img.draggable = false;
    wrap.append(img);
    const dots = new Map();
    const dot = (item, cls = '') => {
        const d = el('span', `hs-dot ${cls}`.trim());
        d.style.left = `${item.spot[0]}%`;
        d.style.top = `${item.spot[1]}%`;
        wrap.append(d);
        dots.set(item.id, d);
        return d;
    };
    const percentOf = e => tapPercent(wrap.getBoundingClientRect(), e.clientX, e.clientY);
    return { wrap, dot, dots, percentOf };
}

function renderEntdecken(root, ctx) {
    const pic = drawPicture(ctx);
    const slot = el('div', 'hs-label-slot');
    for (const it of ctx.items) pic.dot(it, 'is-quiet');
    const clear = () => {
        for (const d of pic.dots.values()) d.classList.remove('is-active');
        slot.replaceChildren();
    };
    pic.wrap.addEventListener('click', e => {
        const id = nearestSpot(ctx.items, ...pic.percentOf(e));
        clear();
        if (!id) return;
        const item = ctx.items.find(i => i.id === id);
        pic.dots.get(id).classList.add('is-active');
        slot.append(drawLabel(item, ctx));
        ctx.speak(labelModel(item).speech);
    });
    root.replaceChildren(pic.wrap, slot);
}

/** zeigen / schmerz: she taps the place. */
function renderTap(root, ctx, promptText) {
    const item = ctx.items.find(i => i.id === ctx.itemId);
    const pic = drawPicture(ctx);
    const prompt = el('div', 'hs-prompt');
    prompt.append(el('span', 'hs-prompt-text', promptText));
    const again = el('button', 'hs-say', '🔊');
    again.type = 'button';
    again.setAttribute('aria-label', 'Vorlesen');
    again.addEventListener('click', () => ctx.speak(promptText));
    prompt.append(again);
    const hint = el('p', 'hs-hint');
    hint.setAttribute('aria-live', 'polite');
    const slot = el('div', 'hs-label-slot');
    let answered = false;
    pic.wrap.addEventListener('click', e => {
        if (answered) return;
        const [x, y] = pic.percentOf(e);
        const id = nearestSpot(ctx.items, x, y);
        if (!id) { hint.textContent = 'Tipp näher an die Stelle.'; return; }
        answered = true;
        hint.textContent = '';
        const ok = id === item.id;
        pic.dot(item, ok ? 'is-right' : 'is-pulse');
        if (!ok) pic.dot(ctx.items.find(i => i.id === id), 'is-wrong');
        slot.append(drawLabel(item, ctx));
        ctx.onAnswer(ok);
    });
    root.replaceChildren(prompt, pic.wrap, hint, slot);
    ctx.speak(promptText);
}

function renderBenennen(root, ctx) {
    const item = ctx.items.find(i => i.id === ctx.itemId);
    const pic = drawPicture(ctx);
    pic.dot(item, 'is-pulse');
    const slot = el('div', 'hs-label-slot');
    const options = el('div', 'hs-options');
    const buttons = new Map();
    for (const id of nameOptions(ctx.items, item.id)) {
        const n = parseNoun(ctx.items.find(i => i.id === id).de);
        const b = el('button', 'hs-option', `${n.article} ${n.noun}`);
        b.type = 'button';
        b.lang = 'de';
        b.addEventListener('click', () => {
            if (slot.hasChildNodes()) return;
            const ok = id === item.id;
            b.classList.add(ok ? 'is-right' : 'is-wrong');
            buttons.get(item.id).classList.add('is-right');
            for (const o of buttons.values()) o.disabled = true;
            pic.dots.get(item.id).classList.replace('is-pulse', 'is-right');
            slot.append(drawLabel(item, ctx));
            ctx.onAnswer(ok);
        });
        buttons.set(id, b);
        options.append(b);
    }
    root.replaceChildren(pic.wrap, options, slot);
}

registerKind('hotspot', {
    renderSet(root, ctx) {
        if (ctx.mode === 'entdecken') renderEntdecken(root, ctx);
        else if (ctx.mode === 'zeigen') renderTap(root, ctx, whereQuestion(ctx.items.find(i => i.id === ctx.itemId)));
        else if (ctx.mode === 'benennen') renderBenennen(root, ctx);
        else if (ctx.mode === 'schmerz') {
            const item = ctx.items.find(i => i.id === ctx.itemId);
            renderTap(root, ctx, painSentence(item, painUsesPlural(ctx.items, item.id)));
        }
    },
});
