// Boards (picture practice): the registry of boards, item keys, loading and progress summaries.
// Pure apart from loadBoard's injected fetch. The screen is boardScreen.js; the schedule is boardSchedule.js.

/**
 * `version` mirrors the data file's (a test checks it); the URL carries it as ?v=.
 * @type {{id: string, title: string, kind: string, file: string, version: number,
 *   modes: {id: string, label: string, scored: boolean}[]}[]}
 */
export const BOARDS = [
    {
        id: 'koerper', title: 'Der Körper', kind: 'hotspot', file: 'data/boards/koerper.json', version: 4,
        modes: [
            { id: 'entdecken', label: 'Entdecken', scored: false },
            { id: 'zeigen', label: 'Zeigen', scored: true },
            { id: 'benennen', label: 'Benennen', scored: true },
            { id: 'schmerz', label: 'Wo tut es weh?', scored: true },
        ],
    },
    {
        id: 'wechsel', title: 'Wo? Wohin?', kind: 'scene', file: 'data/boards/wechselpraepositionen.json', version: 3,
        modes: [
            { id: 'entdecken', label: 'Entdecken', scored: false },
            { id: 'verstehen', label: 'Verstehen', scored: true },
            { id: 'artikel', label: 'Artikel', scored: true },
            { id: 'satz', label: 'Satz', scored: true },
        ],
    },
    {
        id: 'zeit', title: 'Die Zeit', kind: 'timeline', file: 'data/boards/zeit.json', version: 2,
        modes: [
            { id: 'wann', label: 'Wann?', scored: true },
            { id: 'klammer', label: 'Klammer', scored: true },
            { id: 'hilfsverb', label: 'haben oder sein?', scored: true },
        ],
    },
    {
        id: 'fachbegriffe', title: 'Fachsprache und Alltagssprache', kind: 'pairs', file: 'data/boards/fachbegriffe.json', version: 2,
        modes: [
            { id: 'paare', label: 'Paare', scored: false },
            { id: 'patient', label: 'Für den Patienten', scored: true },
            { id: 'kollegin', label: 'Für die Kollegin', scored: true },
        ],
    },
    {
        id: 'station', title: 'Die Station', kind: 'hotspot', file: 'data/boards/station.json', version: 2,
        modes: [
            { id: 'entdecken', label: 'Entdecken', scored: false },
            { id: 'zeigen', label: 'Zeigen', scored: true },
            { id: 'benennen', label: 'Benennen', scored: true },
        ],
    },
];

/**
 * Picture kinds, registered by the kind's module. `renderSet(root, ctx)` draws a set (and may return a teardown);
 * an optional `itemIds(set, modeId)` lists the practice ids of a mode when they are not just the item ids.
 * @type {Object<string, {renderSet: function(HTMLElement, Object): (void|function()), itemIds?: function(Object, string): string[]}>}
 */
export const KINDS = {};
export const registerKind = (kind, impl) => { KINDS[kind] = impl; };

/** The ids practised in a set's mode: the kind's `itemIds` when it has one, else the item ids. */
export function itemIdsFor(board, set, modeId) {
    const hook = KINDS[board.kind]?.itemIds;
    return hook ? hook(set, modeId) : set.items.map(i => i.id);
}

export const boardKey = (boardId, setId, itemId, modeId) => `${boardId}/${setId}/${itemId}:${modeId}`;

/** The registry entry of a board id (or of a loaded board file). */
export function boardDef(id) {
    return BOARDS.find(b => b.id === id) || null;
}

const loaded = new Map();

/** Load a board file once per id; the registry's version goes into the URL. */
export function loadBoard(id, fetchJson) {
    if (!loaded.has(id)) {
        const def = boardDef(id);
        if (!def) return Promise.reject(new Error(`unknown board ${id}`));
        const promise = Promise.resolve(fetchJson(`${def.file}?v=${def.version}`));
        promise.catch(() => loaded.delete(id)); // a failed load may be retried
        loaded.set(id, promise);
    }
    return loaded.get(id);
}

export const isSetLocked = (set, isChapterComplete) =>
    !!set.unlock && !isChapterComplete(set.unlock.level, set.unlock.category);

/** The modes a set offers (set.modes restricts the board's), in the board's order. */
export function setModes(board, set) {
    const def = boardDef(board.id);
    const all = def ? def.modes : [];
    return set.modes ? all.filter(m => set.modes.includes(m.id)) : all;
}

const isDue = (e, now) => !!e && e.due <= now;

/** Counts over unlocked sets and their scored modes (`lockedLabel`: the unlock label of the first locked set when none is open); stored keys of items not in the data are never looked at. */
export function boardSummary(board, getBoard, isChapterComplete, now) {
    let total = 0;
    let learned = 0;
    let due = 0;
    let unlocked = 0;
    let firstLocked = null;
    for (const set of board.sets) {
        if (isSetLocked(set, isChapterComplete)) {
            firstLocked = firstLocked || set;
            continue;
        }
        unlocked++;
        const scored = setModes(board, set).filter(m => m.scored);
        const idsOf = new Map(scored.map(m => [m.id, new Set(itemIdsFor(board, set, m.id))]));
        const all = scored.length ? [...new Set(scored.flatMap(m => [...idsOf.get(m.id)]))] : itemIdsFor(board, set, null);
        for (const id of all) {
            total++;
            const entries = scored.filter(m => idsOf.get(m.id).has(id))
                .map(m => getBoard(boardKey(board.id, set.id, id, m.id)));
            if (entries.length > 0 && entries.every(e => e && e.box >= 1)) learned++;
            due += entries.filter(e => isDue(e, now)).length;
        }
    }
    return { total, learned, due, lockedLabel: unlocked === 0 && firstLocked ? firstLocked.unlock.label : null };
}

/** Where "Wiederholen" starts: the first unlocked set with a due item, and its first scored mode with one. */
export function reviewStart(board, getBoard, isChapterComplete, now) {
    for (const set of board.sets) {
        if (isSetLocked(set, isChapterComplete)) continue;
        for (const mode of setModes(board, set).filter(m => m.scored)) {
            if (itemIdsFor(board, set, mode.id).some(id => isDue(getBoard(boardKey(board.id, set.id, id, mode.id)), now))) {
                return { setId: set.id, modeId: mode.id };
            }
        }
    }
    return null;
}
