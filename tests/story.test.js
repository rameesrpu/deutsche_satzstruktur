import GLib from 'gi://GLib';
import { readText, REPO_ROOT } from './stubs.js';
import { test, assertEqual } from './assert.js';
import { beatsBefore, beatsAfterLast, nextPlayText, chapterStartText, storyStrip } from '../js/storyNarration.js';
import { STORY_CONTENT } from '../js/storyContent.js';
import { LEVEL_CONTENT, chapterOrder, categoryUrl, previousChapter } from '../js/levelContent.js';
import { LevelSelector } from '../js/levelSelector.js';

const beats = [
    { read: 'Intro.' },
    { speaker: 'A', read: 'Hallo!' },
    { play: 'Ich bin hier.' },
    { play: 'Du bist da.', speaker: 'B' },
    { read: 'Dann.' },
    { play: 'Wir gehen.' },
    { read: 'Ende.' },
    { read: 'Wirklich Ende.' },
];

/** Run python3 with `code` in the repo root; returns its stdout (throws on failure). */
function runPython(code) {
    const [, out, err, status] = GLib.spawn_sync(REPO_ROOT, ['python3', '-c', code], null,
        GLib.SpawnFlags.SEARCH_PATH, null);
    const decoder = new TextDecoder('utf-8');
    if (status !== 0) throw new Error(`python3 failed: ${decoder.decode(err)}`);
    return decoder.decode(out);
}

export function runStoryTests() {
    test('story: beatsBefore returns the reads since the previous play beat', () => {
        assertEqual(beatsBefore(beats, 'Ich bin hier.'),
            { lines: [beats[0], beats[1]], play: beats[2] });
        assertEqual(beatsBefore(beats, 'Du bist da.'), { lines: [], play: beats[3] });
        assertEqual(beatsBefore(beats, 'Wir gehen.'), { lines: [beats[4]], play: beats[5] });
        assertEqual(beatsBefore(beats, 'Nicht da.'), null);
    });

    test('story: beatsAfterLast returns the ending reads', () => {
        assertEqual(beatsAfterLast(beats), [beats[6], beats[7]]);
        assertEqual(beatsAfterLast([{ play: 'X.' }]), []);
    });

    test('story: nextPlayText walks the list and stops at the end', () => {
        const texts = ['a', 'b', 'c'];
        assertEqual(nextPlayText(texts, 'a'), 'b');
        assertEqual(nextPlayText(texts, 'c'), null);
        assertEqual(nextPlayText(texts, 'x'), null);
    });

    test('story: chapterStartText resumes in the chapter, else first unplayed, else first', () => {
        const texts = ['a', 'b', 'c'];
        assertEqual(chapterStartText(texts, 'b', () => true), 'b');
        assertEqual(chapterStartText(texts, 'x', t => t === 'a'), 'b');
        assertEqual(chapterStartText(texts, null, () => true), 'a');
        assertEqual(chapterStartText([], null, () => false), null);
    });

    // Built data (scripts/build_stories.py) matches the generated index and level content
    for (const [level, stories] of Object.entries(STORY_CONTENT)) {
        test(`story data ${level}: every chapter's sentences are its play beats, with library words`, () => {
            for (const story of stories) {
                for (const ch of story.chapters) {
                    const data = JSON.parse(readText(ch.file));
                    const plays = data.beats.filter(b => b.play).map(b => b.play);
                    assertEqual(data.sentences, plays, `${ch.key} sentences = play beats`);
                    for (const file of [ch.file, ch.drillFile]) {
                        const lib = JSON.parse(readText(file.replace('data/levels/', 'data/library/')));
                        const src = JSON.parse(readText(file));
                        assertEqual(lib.sentences.map(s => s.text), src.sentences, `${file} library texts`);
                        assertEqual(lib.sentences.every(s => s.words.length === s.text.split(/\s+/).length),
                            true, `${file} one word per token`);
                    }
                }
            }
        });

        test(`story data ${level}: chapter and drill files are fetched with a content version`, () => {
            for (const key of chapterOrder(level)) {
                for (const cat of [LEVEL_CONTENT[level].categories[key], LEVEL_CONTENT[level].categories[`${key}_uebung`]]) {
                    assertEqual(/^[0-9a-f]{10}$/.test(cat.version), true, `${key} version`);
                    assertEqual(categoryUrl(cat), `${cat.file}?v=${cat.version}`);
                    assertEqual(categoryUrl(cat, { library: true }),
                        `${cat.file.replace('data/levels/', 'data/library/')}?v=${cat.version}`);
                }
            }
            const grammar = LEVEL_CONTENT.A1.categories.hauptsatz;
            assertEqual(categoryUrl(grammar), grammar.file, 'grammar files: no version');
        });

        test(`story data ${level}: chapter pictures exist and carry alt text and a version`, () => {
            for (const story of stories) {
                for (const ch of story.chapters) {
                    const { image } = JSON.parse(readText(ch.file));
                    if (!image) continue;
                    const [path, query] = image.src.split('?');
                    assertEqual(/^v=[0-9a-f]{10}$/.test(query || ''), true, `${ch.key} image version`);
                    assertEqual(path.startsWith(`data/stories/${level}/img/`), true, `${ch.key} image path`);
                    readText(path);
                    assertEqual(image.alt.length > 0, true, `${ch.key} image alt`);
                }
            }
        });

        test(`story data ${level}: chapters and drills are in LEVEL_CONTENT in unlock order`, () => {
            const keys = stories.flatMap(s => s.chapters.map(ch => ch.key));
            assertEqual(chapterOrder(level), keys);
            for (const key of keys) {
                assertEqual(LEVEL_CONTENT[level].categories[key].story.kind, 'chapter', key);
                assertEqual(LEVEL_CONTENT[level].categories[`${key}_uebung`].story.kind, 'drill', key);
            }
        });
    }

    // Unlock order across levels: a level's first chapter follows the last chapter of the level below
    test('story: previousChapter steps back within a level, then into the level below', () => {
        const ch = key => ({ key });
        const content = {
            A1: [{ chapters: [ch('g1k1'), ch('g1k2')] }, { chapters: [ch('g2k1')] }],
            A2: [{ chapters: [ch('g1k1'), ch('g1k2')] }],
        };
        assertEqual(previousChapter('A1', 'g1k1', content), null, 'the very first chapter');
        assertEqual(previousChapter('A1', 'g2k1', content), { level: 'A1', key: 'g1k2' });
        assertEqual(previousChapter('A2', 'g1k2', content), { level: 'A2', key: 'g1k1' });
        assertEqual(previousChapter('A2', 'g1k1', content), { level: 'A1', key: 'g2k1' }, 'A2 1.1 after A1 2.1');
        assertEqual(previousChapter('B1', 'g1k1', { ...content, B1: [{ chapters: [ch('g1k1')] }] }),
            { level: 'A2', key: 'g1k2' });
        assertEqual(previousChapter('A2', 'g9k9', content), null, 'unknown chapter');
        assertEqual(previousChapter('A2', 'g1k1', { A2: content.A2 }), null, 'no lower level with chapters');
    });

    test('story: the first A2 chapter stays locked until the last A1 chapter is complete', () => {
        const lastA1 = chapterOrder('A1').at(-1);
        const firstA2 = chapterOrder('A2')[0];
        assertEqual(previousChapter('A2', firstA2), { level: 'A1', key: lastA1 });
        const played = new Set();
        const selector = new LevelSelector(LEVEL_CONTENT, { hasPlayed: (level, key, text) => played.has(`${level}/${key}/${text}`) });
        assertEqual(selector.isUnlocked('A2', firstA2), false, 'A1 file not loaded yet');
        const texts = JSON.parse(readText(LEVEL_CONTENT.A1.categories[lastA1].file)).sentences;
        selector.loadedData.set(`A1/${lastA1}`, { sentences: texts });
        texts.slice(1).forEach(t => played.add(`A1/${lastA1}/${t}`));
        assertEqual(selector.isUnlocked('A2', firstA2), false, 'one A1 sentence not played');
        assertEqual(selector.isUnlocked('A2', `${firstA2}_uebung`), false, 'its drill too');
        played.add(`A1/${lastA1}/${texts[0]}`);
        assertEqual(selector.isUnlocked('A2', firstA2), true, 'A1 complete');
        assertEqual(selector.isUnlocked('A2', `${firstA2}_uebung`), true);
        assertEqual(selector.isUnlocked('A1', chapterOrder('A1')[0]), true, 'A1 1.1 always open');
        assertEqual(selector.isUnlocked('A2', 'nebensatz'), true, 'grammar categories always open');
    });

    // Translations (optional `en` on play items): built into the level file's "translations" map
    test('story: collect_translations keeps only play items with an en, per call', () => {
        const out = runPython(`
import json, sys
sys.path.insert(0, 'scripts')
from build_stories import collect_translations, build_sentence_set
a = collect_translations([{"play": "A b.", "en": "X"}, {"read": "r"}, {"play": "C d."}])
# the same play text in two chapters may carry different translations: one map per call
b = collect_translations([{"play": "A b.", "en": "Y"}])
errors = []
build_sentence_set('A1', [{"read": "Hallo.", "en": "Hello."}], 'x', [], errors)
print(json.dumps({'a': a, 'b': b, 'errors': errors}, ensure_ascii=False))`);
        const { a, b, errors } = JSON.parse(out);
        assertEqual(a, { 'A b.': 'X' });
        assertEqual(b, { 'A b.': 'Y' });
        assertEqual(errors, ['x: en is only for play beats: Hallo.']);
    });

    // Glossary inheritance: a chapter draws on its level's and every lower level's entries
    test('story: an A2 chapter gets the A1 entries it uses; the higher level wins a shared key', () => {
        const out = runPython(`
import json, sys
sys.path.insert(0, 'scripts')
from build_stories import level_glossaries, inherited_glossary, chapter_glossary
e = lambda en, form: {"de": form, "en": en, "forms": [form]}
stories = [
    {"level": "A2", "story": 1, "glossary": {"Kurs": e("course", "Kurs"), "gut": e("good (A2)", "gut")}},
    {"level": "A1", "story": 1, "glossary": {"Haus": e("house", "Haus"), "gut": e("good", "gut")}},
    {"level": "A1", "story": 2, "glossary": {"Haus": e("home", "Haus")}},
    {"level": "B1", "story": 1, "glossary": {"Klinik": e("clinic", "Klinik")}},
]
errors = []
g = level_glossaries(stories, errors)
beats = [{"play": "Das Haus ist gut."}, {"read": "Der Kurs und die Klinik."}]
a2 = chapter_glossary(beats, inherited_glossary(g, "A2"))
a1 = chapter_glossary(beats, inherited_glossary(g, "A1"))
print(json.dumps({"a2": {k: v["en"] for k, v in a2.items()}, "a1": sorted(a1), "errors": errors}))`);
        const { a2, a1, errors } = JSON.parse(out);
        assertEqual(a2, { Haus: 'home', gut: 'good (A2)', Kurs: 'course' }, 'A1 Haus inherited, A2 gut wins, no B1');
        assertEqual(a1, ['Haus', 'gut'], 'A1 chapters get no higher-level entries');
        assertEqual(errors, ['A1 story 2: glossary "Haus" defined twice'], 'still one definition per level');
    });

    for (const [level, stories] of Object.entries(STORY_CONTENT)) {
        test(`story data ${level}: translation keys are sentences of the file; library files carry none`, () => {
            for (const story of stories) {
                for (const ch of story.chapters) {
                    for (const file of [ch.file, ch.drillFile]) {
                        const data = JSON.parse(readText(file));
                        const lib = JSON.parse(readText(file.replace('data/levels/', 'data/library/')));
                        assertEqual('translations' in lib, false, `${file} library untouched`);
                        for (const t of Object.keys(data.translations || {})) {
                            assertEqual(data.sentences.includes(t), true, `${file} translation key ${t}`);
                        }
                    }
                }
            }
        });
    }

    // E2: story line on the play screen
    const r = t => ({ read: t });
    test('story: storyStrip with no narration', () => {
        assertEqual(storyStrip([]), { lines: [], more: false });
        assertEqual(storyStrip(null), { lines: [], more: false });
    });
    test('story: storyStrip with one line', () =>
        assertEqual(storyStrip([r('Eins.')]), { lines: [r('Eins.')], more: false }));
    test('story: storyStrip with two lines shows both', () =>
        assertEqual(storyStrip([r('Eins.'), r('Zwei.')]), { lines: [r('Eins.'), r('Zwei.')], more: false }));
    test('story: storyStrip with 3+ lines keeps the last two, more', () =>
        assertEqual(storyStrip([r('Eins.'), r('Zwei.'), r('Drei.'), r('Vier.')]),
            { lines: [r('Drei.'), r('Vier.')], more: true }));
    test('story: storyStrip keeps speaker beats', () => {
        const lines = [r('Intro.'), { speaker: 'Lea', read: 'Hallo!' }, { speaker: 'Ayisha', read: 'Hi!' }];
        assertEqual(storyStrip(lines), { lines: lines.slice(1), more: true });
    });
    test('story: storyStrip with a custom max', () =>
        assertEqual(storyStrip([r('Eins.'), r('Zwei.')], 1), { lines: [r('Zwei.')], more: true }));
    test('story: storyStrip of beatsBefore (speaker + narrator)', () =>
        assertEqual(storyStrip(beatsBefore(beats, 'Ich bin hier.').lines),
            { lines: [{ read: 'Intro.' }, { speaker: 'A', read: 'Hallo!' }], more: false }));
}
