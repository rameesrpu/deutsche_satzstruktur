// Minimal browser stubs + loader for running app scripts under gjs.
// App files are plain scripts that define globals; we evaluate them inside a
// Function whose parameters shadow the browser globals they touch.

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

export function makeEnv({ innerWidth = 1024 } = {}) {
    const quiet = () => {};
    return {
        window: { innerWidth, innerHeight: 768, addEventListener: quiet },
        document: {
            createElementNS: () => { throw new Error('DOM not stubbed: createElementNS'); },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: quiet,
        },
        localStorage: makeLocalStorage(),
        // App code logs heavily; keep test output readable
        console: { log: quiet, warn: quiet, info: quiet, debug: quiet, error: quiet },
    };
}

/**
 * Evaluate app scripts (paths relative to repo root, in index.html order) and
 * return the requested globals, e.g. loadScripts(['js/gridview.js'], ['GridViewModel']).
 */
export function loadScripts(files, names, env = makeEnv()) {
    const source = files.map(readText).join('\n;\n');
    const params = Object.keys(env);
    const factory = new Function(...params, `${source}\nreturn { ${names.join(', ')} };`);
    return factory(...params.map(p => env[p]));
}
