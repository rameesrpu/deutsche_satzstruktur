import GLib from 'gi://GLib';
import { listDir, readText, REPO_ROOT } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { glossTokens, speakableForm } from '../js/glossary.js';
import { STORY_CONTENT } from '../js/storyContent.js';

const entry = (de, en, forms) => ({ de, en, forms });
const glossary = {
    gehen:     entry('gehen', 'to go', ['geht']),
    aufgehen:  entry('auf|gehen', 'to open', ['geht … auf']),
    aussehen:  entry('aus|sehen', 'to look', ['sieht … aus']),
    auf:       entry('auf', 'on', ['auf']),
    kommen:    entry('kommen', 'to come', ['kommt', 'Kommst']),
    mitkommen: entry('mit|kommen', 'to come along', ['kommt … mit']),
    Tür:       entry('die Tür, -en', 'door', ['Tür']),
    'S-Bahn':  entry('die S-Bahn, -en', 'suburban train', ['S-Bahn']),
    Essen:     entry('das Essen', 'food', ['Essen']),
    lecker:    entry('lecker', 'tasty', ['lecker']),
};

// [text, expected glossed words as "token=key"]
const CASES = [
    ['Die Tür geht auf.', ['Tür=Tür', 'geht=aufgehen', 'auf=aufgehen']],
    ['Dann geht sie in die Küche.', ['geht=gehen']],
    ['Die Tür geht. Auf dem Tisch.', ['Tür=Tür', 'geht=gehen', 'Auf=auf']],
    ['Er schaut auf das Ticket und geht auf.', ['auf=auf', 'geht=aufgehen', 'auf=aufgehen']],
    ['Max kommt mit einer Tüte.', ['kommt=kommen']],
    ['Max kommt auch mit!', ['kommt=mitkommen', 'mit=mitkommen']],
    ['Und sie sieht aus wie eine Frau.', ['sieht=aussehen', 'aus=aussehen']],
    ['Lecker! Dann kommt die S-Bahn.', ['Lecker=lecker', 'kommt=kommen', 'S-Bahn=S-Bahn']],
    ['Das Essen ist lecker, essen wir!', ['Essen=Essen', 'lecker=lecker']],
];

const glossed = pieces => pieces.filter(p => p.key).map(p => `${p.text}=${p.key}`);

/** Run python3 with `code` in the repo root; returns its stdout (throws on failure). */
function runPython(code) {
    const [, out, err, status] = GLib.spawn_sync(REPO_ROOT, ['python3', '-c', code], null,
        GLib.SpawnFlags.SEARCH_PATH, null);
    const decoder = new TextDecoder('utf-8');
    if (status !== 0) throw new Error(`python3 failed: ${decoder.decode(err)}`);
    return decoder.decode(out);
}

export function runGlossaryTests() {
    test('glossary: separable forms, sentence-start capitals, single forms', () => {
        for (const [text, expected] of CASES) {
            assertEqual(glossed(glossTokens(text, glossary)), expected, text);
        }
    });

    test('glossary: pieces join back to the text; no glossary = plain words', () => {
        for (const [text] of CASES) {
            assertEqual(glossTokens(text, glossary).map(p => p.text).join(''), text, text);
        }
        assertEqual(glossTokens('Hallo, du!'), [{ text: 'Hallo' }, { text: ', ' }, { text: 'du' }, { text: '!' }]);
        assertEqual(glossTokens('Die Tür.', glossary)[2].entry, glossary.Tür);
    });

    test('glossary: speakableForm drops plural, notes and separable marker', () => {
        assertEqual(speakableForm('das Gepäckband, -bänder'), 'das Gepäckband');
        assertEqual(speakableForm('aus|sehen (sieht aus)'), 'aussehen');
        assertEqual(speakableForm('aus + Dat.'), 'aus');
        assertEqual(speakableForm('das Essen; essen (isst)'), 'das Essen');
        assertEqual(speakableForm('zu Hause / nach Hause'), 'zu Hause');
    });

    // scripts/build_stories.py has the same matcher (chapter glossaries) plus the unused-form warning
    test('glossary: build_stories.py matches like glossTokens and reports unused forms', () => {
        const out = runPython(`
import json, sys
sys.path.insert(0, 'scripts')
from build_stories import glossary_matches, unused_glossary_forms
g = json.loads(${JSON.stringify(JSON.stringify(glossary))})
texts = ${JSON.stringify(CASES.map(c => c[0]))}
print(json.dumps({
    'matches': [[f'{m[0]}={m[3]}' for m in glossary_matches(t, g) if m[3]] for t in texts],
    'unused': unused_glossary_forms(g, texts),
}, ensure_ascii=False))`);
        const { matches, unused } = JSON.parse(out);
        assertEqual(matches, CASES.map(c => c[1]));
        assertEqual(unused, [['kommen', 'Kommst']]);
    });

    // Built chapter files: each glossary is exactly what glossTokens finds in the chapter
    for (const [level, stories] of Object.entries(STORY_CONTENT)) {
        test(`glossary data ${level}: chapter glossaries match their beats`, () => {
            for (const story of stories) {
                for (const ch of story.chapters) {
                    const data = JSON.parse(readText(ch.file));
                    const g = data.glossary || {};
                    const used = new Set(data.beats.flatMap(b =>
                        glossTokens(b.read || b.play, g).filter(p => p.key).map(p => p.key)));
                    assertEqual([...used].sort(), Object.keys(g).sort(), `${ch.key} glossary`);
                    for (const [key, e] of Object.entries(g)) {
                        assert(e.de && e.en && e.forms.length > 0, `${ch.key} ${key} entry`);
                    }
                }
            }
        });
    }

    // Every word of a built chapter can be tapped (names excepted; numbers are no words): beats with
    // the chapter file's own glossary (what the app shows). Drill files carry no glossary, so their
    // words are checked against the glossary the build draws from: the story files of this level and
    // every lower one (a lower key replaced by the same key of a higher level), as in build_stories.py.
    const names = new Set(readText('data/stories/names.txt').split('\n')
        .map(line => line.split('#')[0].trim()).filter(Boolean));
    const untapped = (text, g) => glossTokens(text, g)
        .filter(p => /\p{L}/u.test(p.text) && !p.key && !names.has(p.text)).map(p => p.text);
    const inherited = {};
    for (const level of Object.keys(STORY_CONTENT).sort()) {
        for (const name of listDir(`data/stories/${level}`).filter(n => n.endsWith('.json'))) {
            Object.assign(inherited, JSON.parse(readText(`data/stories/${level}/${name}`)).glossary || {});
        }
        const glossary = { ...inherited };
        test(`glossary data ${level}: every beat and drill word is tappable`, () => {
            const missing = [];
            for (const ch of STORY_CONTENT[level].flatMap(s => s.chapters)) {
                const data = JSON.parse(readText(ch.file));
                for (const b of data.beats) {
                    for (const w of untapped(b.read || b.play, data.glossary || {})) missing.push(`${ch.key} ${w}`);
                }
                for (const text of JSON.parse(readText(ch.drillFile)).sentences) {
                    for (const w of untapped(text, glossary)) missing.push(`${ch.key}_uebung ${w}`);
                }
            }
            assertEqual(missing, [], `${level} untappable words`);
        });
    }
}

// A sentence-initial "Sie" also matches the formal-Sie key (the matcher folds case): the shown English must cover "she"
test('glossary: sentence-initial Sie means she, the shown English includes she', () => {
    const g = {
        Sie: entry('Sie', 'you (formal); at the start of a sentence also: she, they', ['Sie']),
        sie: entry('sie', 'she, her; they', ['sie']),
    };
    for (const text of ['Sie heißt Ayisha.', 'Sie ist müde, aber sie lächelt.']) {
        const first = glossTokens(text, g).find(p => p.key);
        assert(g[first.key].en.includes('she'), `${text}: ${first.key}`);
    }
});
