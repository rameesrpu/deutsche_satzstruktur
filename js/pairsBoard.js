// pairsBoard: the term-pair board kind (Fachsprache und Alltagssprache). Pure part: choice options,
// a matching round, pair test. DOM part (bottom): the modes Paare / Für den Patienten / Für die Kollegin,
// registered with boardScreen.js as kind 'pairs'.

import { registerKind } from './boards.js';
import { parseNoun } from './hotspotBoard.js';

function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Four item ids including `id`: its `twin` first, then items of the same set (`setId`, when the items carry
 * one), then the rest; items showing the same text on `side` as the asked one are skipped. Shuffled.
 * @param {{id: string, fach: string, alltag: string, twin?: string, setId?: string}[]} items
 * @param {string} id
 * @param {'alltag'|'fach'} side  the side the options show
 * @param {() => number} [rng]
 * @returns {string[]}
 */
export function choiceOptions(items, id, side, rng = Math.random) {
    const asked = items.find(i => i.id === id);
    const chosen = [id];
    const usable = i => i.id !== id && i[side] !== asked[side];
    const twin = asked.twin && items.find(i => i.id === asked.twin);
    if (twin && usable(twin)) chosen.push(twin.id);
    const same = shuffle(items.filter(i => usable(i) && i.setId === asked.setId && !chosen.includes(i.id)), rng);
    const other = shuffle(items.filter(i => usable(i) && i.setId !== asked.setId && !chosen.includes(i.id)), rng);
    for (const i of [...same, ...other]) {
        if (chosen.length >= 4) break;
        chosen.push(i.id);
    }
    return shuffle(chosen, rng);
}

/**
 * A matching round: six items (or all) as twelve shuffled tiles, one per side.
 * @returns {{tiles: {key: string, itemId: string, side: 'fach'|'alltag', text: string}[]}}
 */
export function pairRound(items, rng = Math.random) {
    const picked = shuffle(items, rng).slice(0, 6);
    const tiles = picked.flatMap(i => ['fach', 'alltag'].map(side => ({ key: `${i.id}:${side}`, itemId: i.id, side, text: i[side] })));
    return { tiles: shuffle(tiles, rng) };
}

export const isPair = (a, b) => a.itemId === b.itemId && a.side !== b.side;

/** The words as spoken: no "(pl.)". */
export function speechOf(headword) {
    const n = parseNoun(headword);
    return `${n.article} ${n.noun}`;
}

// ---- DOM part ----

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

function allItemsTagged(ctx) {
    const tagged = ctx.set.items.map(i => ({ ...i, setId: ctx.set.id }));
    for (const s of ctx.board.sets) if (s.id !== ctx.set.id) tagged.push(...s.items.map(i => ({ ...i, setId: s.id })));
    return tagged;
}

function renderPaare(root, ctx) {
    const grid = el('div', 'pr-grid');
    const note = el('p', 'hs-hint');
    note.setAttribute('aria-live', 'polite');
    const again = el('button', 'pr-again', 'Neue Runde');
    again.type = 'button';
    again.hidden = true;
    let buttons = new Map();
    let selected = null;
    let left = 0;
    let busy = false;
    let timer = null;

    const round = () => {
        const { tiles } = pairRound(ctx.items);
        buttons = new Map();
        selected = null;
        left = tiles.length / 2;
        again.hidden = true;
        note.textContent = '';
        grid.replaceChildren(...tiles.map(t => {
            const b = el('button', `pr-tile pr-tile--${t.side}`, t.text);
            b.type = 'button';
            b.lang = 'de';
            b.addEventListener('click', () => pick(t, b));
            buttons.set(t.key, b);
            return b;
        }));
        grid._tiles = tiles;
    };
    const pick = (t, b) => {
        if (busy || b.disabled) return;
        if (!selected) { selected = { t, b }; b.classList.add('is-selected'); return; }
        if (selected.b === b) { b.classList.remove('is-selected'); selected = null; return; }
        const first = selected;
        selected = null;
        if (isPair(first.t, t)) {
            for (const x of [first.b, b]) { x.classList.remove('is-selected'); x.classList.add('is-matched'); x.disabled = true; }
            const item = ctx.items.find(i => i.id === t.itemId);
            note.textContent = `${item.fach} = ${item.alltag} (${item.en})`;
            ctx.speak(speechOf(item.fach));
            if (--left === 0) again.hidden = false;
        } else {
            busy = true;
            first.b.classList.add('is-wrong');
            b.classList.add('is-wrong');
            timer = setTimeout(() => {
                for (const x of [first.b, b]) x.classList.remove('is-wrong', 'is-selected');
                busy = false;
            }, 600);
        }
    };
    again.addEventListener('click', round);
    round();
    root.replaceChildren(grid, note, again);
    return () => clearTimeout(timer);
}

/** patient: fach given, alltag chosen; kollegin: the reverse. */
function renderChoice(root, ctx) {
    const asked = ctx.mode === 'patient' ? 'fach' : 'alltag';
    const shown = asked === 'fach' ? 'alltag' : 'fach';
    const item = ctx.items.find(i => i.id === ctx.itemId);
    const all = allItemsTagged(ctx);
    const prompt = el('div', 'pr-prompt');
    const word = el('div', 'pr-word', item[asked]);
    word.lang = 'de';
    const say = el('button', 'hs-say', '🔊');
    say.type = 'button';
    say.setAttribute('aria-label', 'Vorlesen');
    say.addEventListener('click', () => ctx.say(speechOf(item[asked])));
    prompt.append(word, say);
    const slot = el('div', 'hs-label-slot');
    const options = el('div', 'pr-options');
    const buttons = new Map();
    for (const id of choiceOptions(all, item.id, shown)) {
        const o = all.find(i => i.id === id);
        const b = el('button', 'hs-option pr-option', o[shown]);
        b.type = 'button';
        b.lang = 'de';
        b.addEventListener('click', () => {
            if (slot.hasChildNodes()) return;
            const ok = id === item.id;
            b.classList.add(ok ? 'is-right' : 'is-wrong');
            buttons.get(item.id).classList.add('is-right');
            for (const x of buttons.values()) x.disabled = true;
            const box = el('div', 'hs-label');
            const words = el('div', 'hs-label-word');
            words.lang = 'de';
            words.textContent = `${item.fach} = ${item.alltag}`;
            box.append(words, el('div', 'hs-label-en', item.en));
            slot.append(box);
            ctx.speak(`${speechOf(item.fach)}. ${speechOf(item.alltag)}`);
            ctx.onAnswer(ok);
        });
        buttons.set(id, b);
        options.append(b);
    }
    root.replaceChildren(prompt, options, slot);
    ctx.speak(speechOf(item[asked]));
}

registerKind('pairs', {
    renderSet(root, ctx) {
        if (ctx.mode === 'paare') return renderPaare(root, ctx);
        renderChoice(root, ctx);
        return undefined;
    },
});
