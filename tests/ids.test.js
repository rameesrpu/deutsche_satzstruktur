import { listDir, makeLocalStorage, readText } from './stubs.js';
import { test, assertEqual } from './assert.js';
import { nextId, reserveIdsAbove } from '../js/ids.js';
import { SentenceManager } from '../js/sentenceManager.js';

const allUnique = ids => new Set(ids).size === ids.length;
const sentenceIds = sm => sm.sentences.map(s => s.id);
const wordIds = sm => sm.sentences.flatMap(s => s.words.map(w => w.id));

export function runIdTests() {
    test('bulk-loading every library category back to back gives unique ids', () => {
        globalThis.localStorage = makeLocalStorage();
        const sm = new SentenceManager(null);
        for (const file of listDir('data/library')) {
            const data = JSON.parse(readText(`data/library/${file}`));
            sm.bulkLoadLibraryCategory(data.level, file, data);
        }
        assertEqual(sm.sentences.length, 782, 'sentence count');
        assertEqual(allUnique(sentenceIds(sm)), true, 'sentence ids unique');
        assertEqual(allUnique(wordIds(sm)), true, 'word ids unique');
    });

    const duplicated = () => [
        { id: 5, text: 'a', words: [{ id: 10 }, { id: 11 }] },
        { id: 5, text: 'b', words: [{ id: 10 }, { id: 12 }] },
        { id: 6, text: 'c', words: [{ id: 11 }] },
    ];

    test('repairDuplicateIds keeps first occurrence and is idempotent', () => {
        globalThis.localStorage = makeLocalStorage();
        const sm = new SentenceManager(null);
        sm.sentences = duplicated();
        assertEqual(sm.repairDuplicateIds(), 2, 'sentences changed');
        assertEqual(sm.sentences[0].id, 5);
        assertEqual(sm.sentences[0].words.map(w => w.id), [10, 11]);
        assertEqual(sm.sentences[1].words[1].id, 12, 'unique word id kept');
        assertEqual(allUnique(sentenceIds(sm)), true, 'sentence ids unique');
        assertEqual(allUnique(wordIds(sm)), true, 'word ids unique');
        assertEqual(sm.repairDuplicateIds(), 0, 'second run changes nothing');
    });

    test('load() repairs duplicate ids in localStorage and saves them', () => {
        globalThis.localStorage = makeLocalStorage();
        localStorage.setItem('deutschSentences', JSON.stringify(duplicated()));
        const sm = new SentenceManager(null);
        sm.load();
        const stored = JSON.parse(localStorage.getItem('deutschSentences'));
        assertEqual(allUnique(stored.map(s => s.id)), true, 'stored sentence ids unique');
    });

    test('nextId stays above ids reserved from storage', () => {
        const far = Date.now() + 1e9;
        reserveIdsAbove(far);
        assertEqual(nextId(), far + 1);
    });
}
