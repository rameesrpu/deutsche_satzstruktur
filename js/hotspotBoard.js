// hotspotBoard: pure logic of the picture-spot board kind (body map): noun parsing, which spot a tap
// meets, naming options, pain sentence. The DOM renderer is added to this file in a later task.

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
