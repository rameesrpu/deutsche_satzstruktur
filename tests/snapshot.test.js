// Golden snapshot: parseSentenceFlow + getWordPosition over every library sentence.
// Any behavior change (refactor, data edit) shows up as a diff in tests/snapshots/library.json.

import { listDir, readText, writeText } from './stubs.js';
import { test, assertEqual } from './assert.js';

const SNAPSHOT = 'tests/snapshots/library.json';

import { GridViewModel } from '../js/gridview.js';

// "text@row,col" — compact and diff-friendly; no "@" when the word has no cell
function describe(gv, word) {
    const pos = gv.getWordPosition(word);
    return pos ? `${word.text}@${pos.row},${pos.col}` : word.text;
}

function snapshotSentence(gv, words) {
    const flow = gv.parseSentenceFlow(words);
    return {
        leading: flow.leadingWords.map(w => describe(gv, w)),
        boxes: flow.boxes.map(b =>
            `${b.words.map(w => w.text).join(' ')} → ${describe(gv, b.mainWord)}/${b.case}`),
        connections: flow.connections.map(c => c.map(w => describe(gv, w))),
    };
}

function buildSnapshot() {
    const gv = new GridViewModel(null);
    const snapshot = {};
    for (const file of listDir('data/library').filter(n => n.endsWith('.json'))) {
        const data = JSON.parse(readText(`data/library/${file}`));
        data.sentences.forEach((s, i) => {
            if (s.words) snapshot[`${file} #${i} ${s.text}`] = snapshotSentence(gv, s.words);
        });
    }
    return snapshot;
}

export function runLibrarySnapshot({ update }) {
    const current = buildSnapshot();

    if (update) {
        writeText(SNAPSHOT, JSON.stringify(current, null, 1) + '\n');
        print(`Snapshot updated: ${Object.keys(current).length} sentences → ${SNAPSHOT}`);
        return;
    }

    let stored;
    try {
        stored = JSON.parse(readText(SNAPSHOT));
    } catch (e) {
        test('library snapshot exists', () => { throw new Error(`${SNAPSHOT} missing — run with --update`); });
        return;
    }

    const keys = new Set([...Object.keys(stored), ...Object.keys(current)]);
    for (const key of keys) {
        test(`snapshot: ${key}`, () => assertEqual(current[key], stored[key]));
    }
}
