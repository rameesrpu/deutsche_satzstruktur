import { test, assertEqual } from './assert.js';
import { readerParagraphs, readerTitles, readProgress } from '../js/storyReader.js';
import { LEVEL_CONTENT } from '../js/levelContent.js';

export function runStoryReaderTests() {
    test('reader: readerParagraphs joins runs of speakerless play sentences', () => {
        const beats = [
            { read: 'Oktober.' },
            { read: 'Am Fenster.' },
            { speaker: 'Der Pilot', play: 'Wir sind gleich da.' },
            { play: 'Sie heißt Ayisha.' },
            { play: 'Ayisha ist Ärztin.' },
            { read: 'Kerala.' },
            { play: 'Die Tür geht auf.' },
            { speaker: 'Max', play: 'Hallo!' },
            { speaker: 'Max', play: 'Komm!' },
        ];
        const shape = readerParagraphs(beats).map(p => p.length);
        assertEqual(shape, [1, 1, 1, 2, 1, 1, 1, 1]);
        assertEqual(readerParagraphs(beats).flat(), beats);
        assertEqual(readerParagraphs([]), []);
    });

    test('reader: readerTitles splits chapter number and story name', () => {
        assertEqual(readerTitles('1.1 Hallo, Stuttgart!', 'Geschichte 1: Ankunft'),
            { label: 'Ankunft · Kapitel 1.1', title: 'Hallo, Stuttgart!' });
        assertEqual(readerTitles('1.1 Hallo', null), { label: 'Kapitel 1.1', title: 'Hallo' });
        assertEqual(readerTitles('Ohne Nummer', 'Extra'), { label: 'Extra', title: 'Ohne Nummer' });
    });

    test('reader: readProgress is the share above the viewport bottom', () => {
        assertEqual(readProgress(0, 800, 600), 1);
        assertEqual(readProgress(0, 500, 1000), 0.5);
        assertEqual(readProgress(500, 500, 1000), 1);
        assertEqual(readProgress(900, 500, 1000), 1);
    });

    test('reader: chapter labels from storyContent parse', () => {
        // app.js passes cat.label / "Geschichte n: title"; every chapter label has a number
        let n = 0;
        for (const level of Object.values(LEVEL_CONTENT)) {
            for (const cat of Object.values(level.categories || {})) {
                if (!cat.story || cat.story.kind !== 'chapter') continue;
                const { label, title } = readerTitles(cat.label, `Geschichte ${cat.story.storyNo}: ${cat.story.storyTitle}`);
                assertEqual(label.startsWith(cat.story.storyTitle + ' · Kapitel '), true, cat.label);
                assertEqual(title.length > 0, true, cat.label);
                n++;
            }
        }
        assertEqual(n > 0, true, 'no story chapters found');
    });
}
