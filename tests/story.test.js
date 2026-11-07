import { readText } from './stubs.js';
import { test, assertEqual } from './assert.js';
import { beatsBefore, beatsAfterLast, nextPlayText, chapterStartText, storyStrip } from '../js/storyNarration.js';
import { STORY_CONTENT } from '../js/storyContent.js';
import { LEVEL_CONTENT, chapterOrder } from '../js/levelContent.js';

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
