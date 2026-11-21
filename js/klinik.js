// Klinik (body[data-screen="klinik"]): tiles of the hospital section and the route view of the
// path to the Approbation. Pure helpers first (routeState, toggleStation, tileMode), then the renderers.
// The route file is data/medical/approbation.json (stations with their sources and check dates).
// The Anamnese tile opens a menu (renderAnamneseMenu); "Fragen sortieren" sorts standard questions
// from data/medical/anamnese.json into the Anamnese sections (questionSortModel, on the sort screen);
// "Gespräch" lists the cases of data/medical/faelle/index.json (renderCaseList; the interview is caseScreen.js).

export const KLINIK_ROUTE_FILE = 'data/medical/approbation.json';
export const KLINIK_ROUTE_VERSION = 1; // mirrors the file's `version`; part of the URL as ?v=
export const KLINIK_STORAGE_KEY = 'klinikRoute';
export const ANAMNESE_FILE = 'data/medical/anamnese.json';
export const ANAMNESE_VERSION = 1; // mirrors the file's `version`; part of the URL as ?v=
export const QUESTION_SORT_TITLE = 'Wohin gehört die Frage?';

/** @type {{id: string, title: string, level: ?string, open: 'route'|'board'|'anamnese'|'soon', boardId: ?string}[]} */
export const KLINIK_TILES = [
    { id: 'weg', title: 'Der Weg zur Approbation', level: null, open: 'route', boardId: null },
    { id: 'fachbegriffe', title: 'Fachsprache und Alltagssprache', level: null, open: 'board', boardId: 'fachbegriffe' },
    { id: 'station', title: 'Die Station', level: null, open: 'board', boardId: 'station' },
    { id: 'anamnese', title: 'Anamnese', level: 'ab B1', open: 'anamnese', boardId: null },
    { id: 'arztbrief', title: 'Arztbrief', level: 'ab B2', open: 'soon', boardId: null },
    { id: 'fsp', title: 'Fachsprachenprüfung', level: 'ab B2', open: 'soon', boardId: null },
];

/** Note under the route tile: the progress, or a short notice when the route file is missing. */
export function routeNote(route) {
    return route ? `${route.doneCount} von ${route.total} Schritten` : 'Gerade nicht verfügbar.';
}

/** A board tile whose board is not registered yet behaves like a 'soon' tile. */
export function tileMode(tile, knownBoardIds) {
    if (tile.open === 'board' && !knownBoardIds.includes(tile.boardId)) return 'soon';
    return tile.open;
}

/**
 * "Fragen sortieren": `size` random questions as chips, the sections as zones. A chip's zones are its
 * own section first (auto-place target), then its `also` sections.
 * @param {{sections: {id: string, title: string, questions: {id: string, de: string, en: string, also?: string[]}[]}[]}} anamnese
 * @param {() => number} [rng]
 * @param {number} [size]
 * @returns {import('./sortExercise.js').SortModel}
 */
export function questionSortModel(anamnese, rng = Math.random, size = 10) {
    const all = anamnese.sections.flatMap(s => s.questions.map(q => ({
        id: q.id, text: q.de, en: q.en, zones: [s.id, ...(q.also || []).filter(a => a !== s.id)],
    })));
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return {
        title: QUESTION_SORT_TITLE,
        zones: anamnese.sections.map(s => ({ id: s.id, title: s.title })),
        chips: all.slice(0, size),
    };
}

const formatDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
};

/**
 * Progress along the route. Unknown ids are ignored; `next` marks the first open required station.
 * total/doneCount count the required (non-optional) stations only.
 */
export function routeState(stations, doneIds) {
    const done = new Set(doneIds);
    let nextSeen = false;
    const rows = stations.map(s => {
        const isDone = done.has(s.id);
        const next = !isDone && !s.optional && !nextSeen;
        if (next) nextSeen = true;
        return { id: s.id, title: s.title, optional: !!s.optional, done: isDone, next };
    });
    const required = rows.filter(r => !r.optional);
    const dates = stations.map(s => s.checked).filter(Boolean).sort();
    return {
        stations: rows,
        doneCount: required.filter(r => r.done).length,
        total: required.length,
        stand: dates.length ? formatDate(dates[0]) : '',
    };
}

export function toggleStation(doneIds, id) {
    return doneIds.includes(id) ? doneIds.filter(d => d !== id) : [...doneIds, id];
}

export function loadDone(storage) {
    try {
        const v = JSON.parse(storage.getItem(KLINIK_STORAGE_KEY));
        return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch (e) { return []; }
}

export function saveDone(storage, ids) {
    try { storage.setItem(KLINIK_STORAGE_KEY, JSON.stringify(ids)); } catch (e) { /* private mode */ }
}

// --- Rendering ---

const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function topBar(title, label, onClick, back = false) {
    const bar = el('div', 'klinik-bar');
    const b = el('button', back ? 'board-back klinik-back' : 'klinik-close');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    if (back) b.textContent = `‹ ${back === true ? 'Klinik' : back}`; else b.innerHTML = CLOSE_ICON;
    b.addEventListener('click', onClick);
    bar.append(b, el('h1', 'klinik-title', title));
    return bar;
}

/**
 * @param {HTMLElement} root
 * @param {{tiles: {id, title, level, open, boardId}[], route: ?ReturnType<typeof routeState>, boardIds?: string[]}} state
 * @param {{openRoute: function(), openBoard: function(string), openAnamnese: function(), close: function()}} actions
 */
export function renderKlinik(root, state, actions) {
    const known = state.boardIds || [];
    const inner = el('div', 'screen-inner klinik-inner');
    inner.append(topBar('Klinik', 'Schließen', actions.close));
    const grid = el('div', 'klinik-tiles');
    for (const tile of state.tiles) {
        const mode = tileMode(tile, known);
        const b = el('button', 'klinik-tile');
        b.type = 'button';
        b.append(el('span', 'klinik-tile-title', tile.title));
        if (tile.level) b.append(el('span', 'klinik-tile-level', tile.level));
        if (mode === 'soon') {
            b.classList.add('is-soon');
            b.disabled = true;
            b.append(el('span', 'klinik-tile-note', 'Kommt bald'));
        } else if (mode === 'route') {
            b.append(el('span', 'klinik-tile-note', routeNote(state.route)));
            if (state.route) b.addEventListener('click', () => actions.openRoute());
            else { b.classList.add('is-soon'); b.disabled = true; }
        } else if (mode === 'anamnese') {
            b.addEventListener('click', () => actions.openAnamnese());
        } else {
            b.addEventListener('click', () => actions.openBoard(tile.boardId));
        }
        grid.append(b);
    }
    inner.append(grid);
    root.replaceChildren(inner);
}

function menuTile(title, available, onClick, note = null) {
    const b = el('button', 'klinik-tile');
    b.type = 'button';
    b.append(el('span', 'klinik-tile-title', title));
    if (available) {
        if (note) b.append(el('span', 'klinik-tile-level', note));
        b.addEventListener('click', onClick);
    } else {
        b.classList.add('is-soon');
        b.disabled = true;
        b.append(el('span', 'klinik-tile-note', 'Gerade nicht verfügbar.'));
    }
    return b;
}

/**
 * Anamnese menu: the exercises of the Anamnese tile. Without the question file the buttons are off;
 * "Gespräch" also needs the case list.
 * @param {HTMLElement} root
 * @param {{available: boolean, cases?: ?{id: string, title: string, level: string}[]}} state
 * @param {{sortQuestions: function(), openCases: function(), back: function()}} actions
 */
export function renderAnamneseMenu(root, state, actions) {
    const inner = el('div', 'screen-inner klinik-inner');
    inner.append(topBar('Anamnese', 'Zurück', actions.back, true));
    const grid = el('div', 'klinik-tiles');
    const cases = state.cases || [];
    grid.append(menuTile('Fragen sortieren', state.available, () => actions.sortQuestions()),
        menuTile('Gespräch', state.available && cases.length > 0, () => actions.openCases(),
            cases.length === 1 ? '1 Fall' : `${cases.length} Fälle`));
    inner.append(grid);
    root.replaceChildren(inner);
}

/**
 * The cases of one exercise ("Gespräch"): one tile per case with its level.
 * @param {HTMLElement} root
 * @param {{title: string, cases: {id: string, title: string, level: string}[]}} state
 * @param {{openCase: function(string), back: function()}} actions
 */
export function renderCaseList(root, state, actions) {
    const inner = el('div', 'screen-inner klinik-inner');
    inner.append(topBar(state.title, 'Zurück', actions.back, 'Anamnese'));
    const grid = el('div', 'klinik-tiles');
    for (const c of state.cases) grid.append(menuTile(c.title, true, () => actions.openCase(c.id), c.level));
    inner.append(grid);
    root.replaceChildren(inner);
}

/**
 * @param {HTMLElement} root
 * @param {{stations: Object[], route: ReturnType<typeof routeState>}} state
 * @param {{toggle: function(string), back: function()}} actions  toggle re-renders by the caller
 * @param {string} [openId]  station whose card is open
 */
export function renderRoute(root, state, actions, openId = null) {
    const { route } = state;
    const inner = el('div', 'screen-inner klinik-inner');
    inner.append(topBar('Der Weg zur Approbation', 'Zurück', actions.back, true));
    inner.append(el('p', 'klinik-count', `${route.doneCount} von ${route.total} Schritten`));
    const list = el('ol', 'route-list');
    for (const row of route.stations) {
        const s = state.stations.find(x => x.id === row.id);
        const li = el('li', 'route-item');
        if (row.done) li.classList.add('is-done');
        if (row.next) li.classList.add('is-next');
        if (row.optional) li.classList.add('is-optional');
        const head = el('button', 'route-head');
        head.type = 'button';
        head.setAttribute('aria-expanded', String(openId === row.id));
        head.append(el('span', 'route-node'), el('span', 'route-name', row.title));
        if (row.optional) head.append(el('span', 'route-tag', 'nur manchmal'));
        head.addEventListener('click', () => renderRoute(root, state, actions, openId === row.id ? null : row.id));
        li.append(head);
        if (openId === row.id && s) li.append(stationCard(s, row, actions));
        list.append(li);
    }
    inner.append(list);
    inner.append(el('p', 'klinik-stand', `Stand: ${route.stand}`),
        el('p', 'klinik-stand', 'Ohne Gewähr. Maßgeblich sind die Angaben der Behörden.'));
    root.replaceChildren(inner);
}

function stationCard(s, row, actions) {
    const card = el('div', 'route-card');
    card.append(el('p', 'route-what', s.what), el('p', 'route-en', s.en));
    const facts = [['Wörter', (s.terms || []).map(t => `${t.de} – ${t.en}`)],
        ['Unterlagen', s.documents || []]];
    for (const [label, items] of facts) {
        if (!items.length) continue;
        card.append(el('h4', 'route-label', label));
        const ul = el('ul', 'route-facts');
        for (const it of items) ul.append(el('li', '', it));
        card.append(ul);
    }
    for (const [label, value] of [['Dauer', s.duration], ['Kosten', s.cost], ['Zuständig', s.authority]]) {
        if (!value) continue;
        const p = el('p', 'route-fact');
        p.append(el('strong', '', `${label}: `), document.createTextNode(value));
        card.append(p);
    }
    if (s.source) {
        const a = el('a', 'route-source', 'Quelle');
        a.href = s.source;
        a.target = '_blank';
        a.rel = 'noopener';
        card.append(a);
    }
    const done = el('button', 'route-done', row.done ? 'Doch nicht erledigt' : 'Erledigt');
    done.type = 'button';
    done.addEventListener('click', () => actions.toggle(row.id));
    card.append(done);
    return card;
}
