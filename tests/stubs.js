// Minimal browser stubs + file helpers for running the app's ES modules under gjs.
// Import this module first (tests/run.js does): it installs window/document/
// localStorage/console stubs on globalThis before any js/ module is evaluated.

import GLib from 'gi://GLib';

export const REPO_ROOT = GLib.path_get_dirname(
    GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));

const decoder = new TextDecoder('utf-8');

export function readText(relPath) {
    const [ok, bytes] = GLib.file_get_contents(GLib.build_filenamev([REPO_ROOT, relPath]));
    if (!ok) throw new Error(`Cannot read ${relPath}`);
    return decoder.decode(bytes);
}

export function writeText(relPath, text) {
    GLib.file_set_contents(GLib.build_filenamev([REPO_ROOT, relPath]), text);
}

export function listDir(relPath) {
    const dir = GLib.Dir.open(GLib.build_filenamev([REPO_ROOT, relPath]), 0);
    const names = [];
    let name;
    while ((name = dir.read_name()) !== null) names.push(name);
    dir.close();
    return names.sort();
}

export function makeLocalStorage() {
    const store = new Map();
    return {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
        clear: () => store.clear(),
    };
}

export function installBrowserStubs({ innerWidth = 1024 } = {}) {
    const quiet = () => {};
    // gjs predefines a read-only `window` that is globalThis, so window.* stubs go on globalThis
    Object.assign(globalThis, {
        innerWidth, innerHeight: 768, addEventListener: quiet,
        location: { hostname: 'localhost', protocol: 'http:' },
        document: {
            createElementNS: () => { throw new Error('DOM not stubbed: createElementNS'); },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: quiet,
        },
        localStorage: makeLocalStorage(),
    });
    // App code logs heavily; keep test output readable (results use print()). gjs's
    // `console` is frozen, so drop its messages at the GLib log writer instead and
    // pass everything else (e.g. uncaught JS errors) through to stderr.
    GLib.log_set_writer_func((level, fields) => {
        const field = name => (fields[name] ? decoder.decode(fields[name]) : '');
        if (field('GLIB_DOMAIN') !== 'Gjs-Console') printerr(`${field('GLIB_DOMAIN')}: ${field('MESSAGE')}`);
        return GLib.LogWriterOutput.HANDLED;
    });
}

installBrowserStubs();

/**
 * Words from story tags (data/stories/CURRICULUM.md), like scripts/build_stories.py:
 * S.<p> subject, O.<p>.<case> object, V.<p>/M.<p> finite verb/modal, V non-finite verb,
 * P preposition/particle, X other, K coord. conjunction, C subordinating conjunction, "/" next clause.
 */
export function tagged(text, tags) {
    const tokens = text.split(' ');
    const simple = { P: 'preposition', X: 'other', K: 'coord-conjunction', C: 'conjunction' };
    let clause = 0;
    const words = [];
    for (const tag of tags.split(' ')) {
        if (tag === '/') { clause++; continue; }
        const [kind, p, c] = tag.split('.');
        const type = simple[kind] || { S: 'subject', O: 'object', V: 'verb', M: 'modal' }[kind];
        const finite = (kind === 'V' || kind === 'M') && p;
        const word = { type, text: tokens[words.length], clause_type: 'main', clause_id: clause,
            conjugation: { pronoun: finite || kind === 'S' ? p : 'none' } };
        // Noun phrases: S.<gender>[.<case>] / O.<gender>[.<case>] (case defaults: S nom, O akk)
        if (kind === 'S' || kind === 'O') { word.gender = p; word.case = c || (kind === 'S' ? 'nom' : 'akk'); }
        words.push(word);
    }
    if (words.length !== tokens.length) throw new Error(`tags don't match: ${text}`);
    return words;
}
