// Boards (picture practice): the registry of boards, item keys, loading and progress summaries.
// Pure apart from loadBoard's injected fetch. The screen is boardScreen.js; the schedule is boardSchedule.js.

/**
 * `version` mirrors the data file's (a test checks it); the URL carries it as ?v=.
 * @type {{id: string, title: string, kind: string, file: string, version: number,
 *   modes: {id: string, label: string, scored: boolean}[]}[]}
 */
export const BOARDS = [
    {
        id: 'koerper', title: 'Der Körper', kind: 'hotspot', file: 'data/boards/koerper.json', version: 2,
        modes: [
            { id: 'entdecken', label: 'Entdecken', scored: false },
            { id: 'zeigen', label: 'Zeigen', scored: true },
            { id: 'benennen', label: 'Benennen', scored: true },
            { id: 'schmerz', label: 'Wo tut es weh?', scored: true },
        ],
    },
];

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

/** Counts over unlocked sets and their scored modes; stored keys of items not in the data are never looked at. */
export function boardSummary(board, getBoard, isChapterComplete, now) {
    let total = 0;
    let learned = 0;
    let due = 0;
    for (const set of board.sets) {
        if (isSetLocked(set, isChapterComplete)) continue;
        const scored = setModes(board, set).filter(m => m.scored);
        for (const item of set.items) {
            total++;
            const entries = scored.map(m => getBoard(boardKey(board.id, set.id, item.id, m.id)));
            if (scored.length > 0 && entries.every(e => e && e.box >= 1)) learned++;
            due += entries.filter(e => isDue(e, now)).length;
        }
    }
    return { total, learned, due };
}

/** Where "Wiederholen" starts: the first unlocked set with a due item, and its first scored mode with one. */
export function reviewStart(board, getBoard, isChapterComplete, now) {
    for (const set of board.sets) {
        if (isSetLocked(set, isChapterComplete)) continue;
        for (const mode of setModes(board, set).filter(m => m.scored)) {
            if (set.items.some(it => isDue(getBoard(boardKey(board.id, set.id, it.id, mode.id)), now))) {
                return { setId: set.id, modeId: mode.id };
            }
        }
    }
    return null;
}
