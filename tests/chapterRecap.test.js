import { test, assertEqual, assert } from './assert.js';
import { recapStats, hardSentences, underlineParts, missReason, wordChip, newGlossaryEntries,
    chipList, recapTitle, buildRecapModel, MAX_HARD } from '../js/chapterRecap.js';

const miss = (over = {}) => ({
    start: 0, end: 1, phrase: 'Ihre Heimat', key: 'fem', cellWrong: true, caseWrong: false,
    chosenCell: 'PLURAL', chosenCase: 'nom', expectedCell: 'FEMININ', expectedCase: 'nom', why: 'Heimat ist feminin (die Heimat), hier Subjekt → Nominativ',
    attempts: 1, ...over,
});
const sentence = (text, items, misses = []) => ({ text, words: text.split(' '), items, misses });

export function runChapterRecapTests() {
    test('recap: stats count first-try placements over all placements', () => {
        const results = [
            sentence('Ihre Heimat ist Kerala.', 3, [miss({ attempts: 3 })]),
            sentence('Das Wetter ist kalt.', 3),
            sentence('Komm!', 0),
        ];
        assertEqual(recapStats(results, 9),
            { sentences: 3, placements: 6, firstTry: 5, percent: 83, newWords: 9 });
        assertEqual(recapStats([sentence('Komm!', 0)], 0).percent, null);
        assertEqual(recapStats([], 0).sentences, 0);
    });

    test('recap: hardSentences = sentences with misses, worst first, then order', () => {
        const a = sentence('a b', 2, [miss({ attempts: 1 })]);
        const b = sentence('c d', 2);
        const c = sentence('e f', 2, [miss({ attempts: 3 })]);
        const d = sentence('g h', 2, [miss({ attempts: 1 }), miss({ start: 1, end: 1, attempts: 0 })]);
        const e = sentence('i j', 2, [miss({ attempts: 1 })]);
        assertEqual(hardSentences([a, b, c, d, e]).map(r => r.text), ['e f', 'g h', 'a b', 'i j']);
        assertEqual(hardSentences([b]), []);
    });

    test('recap: underlineParts marks missed phrases with their palette key', () => {
        const words = ['Ihre', 'Heimat', 'ist', 'Kerala.'];
        assertEqual(underlineParts(words, [miss()]),
            [{ text: 'Ihre Heimat', key: 'fem' }, { text: 'ist Kerala.', key: null }]);
        assertEqual(underlineParts(words, []), [{ text: 'Ihre Heimat ist Kerala.', key: null }]);
        // Two adjacent phrases of the same key stay separate parts
        assertEqual(underlineParts(['du', 'bist', 'da'],
            [miss({ start: 0, end: 0, key: 'du' }), miss({ start: 1, end: 1, key: 'du' })]),
        [{ text: 'du', key: 'du' }, { text: 'bist', key: 'du' }, { text: 'da', key: null }]);
    });

    test('recap: missReason names what was chosen and why it is right', () => {
        assertEqual(missReason(miss()), { chosen: 'Plural', answer: 'Feminin', why: miss().why });
        const akk = missReason(miss({ cellWrong: false, caseWrong: true, chosenCase: 'akk' }));
        assertEqual([akk.chosen, akk.answer], ['Akkusativ', 'Nominativ']);
        const both = missReason(miss({ caseWrong: true, chosenCase: 'dat', chosenCell: 'ICH', expectedCell: 'DU' }));
        assertEqual([both.chosen, both.answer], ['ich + Dativ', 'du + Nominativ']);
        assertEqual(missReason(miss({ cellWrong: false, caseWrong: true, chosenCase: null })).chosen, 'keinen Fall');
        assertEqual(missReason(miss({ caseWrong: true, chosenCase: null })).chosen, 'Plural ohne Fall');
    });

    test('recap: wordChip strips plural/notes and reads the gender from the article', () => {
        assertEqual(wordChip({ de: 'das Flugzeug, -e', en: 'plane' }),
            { label: 'das Flugzeug', gender: 'neut', de: 'das Flugzeug, -e', en: 'plane' });
        assertEqual(wordChip({ de: 'die Ärztin, -nen', en: 'doctor' }).gender, 'fem');
        assertEqual(wordChip({ de: 'der Morgen / morgen', en: 'morning' }).label, 'der Morgen');
        assertEqual(wordChip({ de: 'das Essen; essen (isst)', en: 'food' }).label, 'das Essen');
        const leute = wordChip({ de: 'die Leute (pl.)', en: 'people' });
        assertEqual([leute.label, leute.gender], ['die Leute', 'pl']);
        const werden = wordChip({ de: 'werden (wird)', en: 'to become' });
        assertEqual([werden.label, werden.gender], ['werden', null]);
        assertEqual(wordChip({ de: 'aus + Dat.', en: 'from' }).label, 'aus + Dat.');
        assertEqual(wordChip({ de: 'nach|denken', en: 'to think' }).label, 'nachdenken');
        assertEqual(wordChip({ de: 'der/die/das beste', en: 'best' }).gender, null);
    });

    test('recap: new words = glossary entries no earlier chapter had; nouns first', () => {
        const g1 = { Haus: { de: 'das Haus' }, alt: { de: 'alt' } };
        const g2 = { Haus: { de: 'das Haus' }, klein: { de: 'klein' }, Tür: { de: 'die Tür, -en' } };
        assertEqual(newGlossaryEntries(g2, [g1]).map(e => e.de), ['klein', 'die Tür, -en']);
        assertEqual(newGlossaryEntries(g1).length, 2);
        const { chips, more } = chipList(newGlossaryEntries(g2, [g1]), 1);
        assertEqual([chips.map(c => c.label), more], [['die Tür'], 1]);
    });

    test('recap: title = short last line of the closing narration, else the chapter title', () => {
        const data = (read, extra = {}) => ({ title: 'Hallo, Stuttgart!',
            beats: [{ play: 'Wer ist der Mann?' }, { read, ...extra }] });
        assertEqual(recapTitle(data('Ayisha schaut auf das Ticket. Ihr Abenteuer beginnt.')), 'Ihr Abenteuer beginnt.');
        assertEqual(recapTitle(data('Und hinter dem Schrank … ist da etwas?')), 'Hallo, Stuttgart!');
        assertEqual(recapTitle(data('Das ist Frau Schäfer.', { speaker: 'Lea' })), 'Hallo, Stuttgart!');
        assertEqual(recapTitle({ title: 'T', beats: [{ play: 'x' }] }), 'T');
        assertEqual(recapTitle(null, 'fallback'), 'fallback');
    });

    test('recap: buildRecapModel assembles kicker, hard sentences, replay list and next', () => {
        const results = [1, 2, 3, 4].map(i => sentence(`s${i} x`, 2, [miss({ attempts: i })]))
            .concat(sentence('ok x', 2));
        const chapter = { id: '1.1', label: '1.1 Hallo, Stuttgart!',
            data: { title: 'Hallo, Stuttgart!', beats: [], glossary: { a: { de: 'die Luft' }, b: { de: 'müde' } } } };
        const next = { id: '1.2', label: '1.2 Die WG', unlocked: true };
        const m = buildRecapModel({ chapter, results, complete: true, next });
        assertEqual(m.kicker, 'Kapitel 1.1 geschafft');
        assertEqual(m.title, 'Hallo, Stuttgart!');
        assertEqual(m.stats.percent, 60);
        assertEqual(m.stats.newWords, 2);
        assertEqual(m.hard.length, MAX_HARD);
        assertEqual(m.hard.map(h => h.text), ['s4 x', 's3 x', 's2 x']);
        assertEqual(m.hardTexts, ['s4 x', 's3 x', 's2 x', 's1 x']);
        assertEqual(m.hard[0].reason.chosen, 'Plural');
        assertEqual(m.lockedHint, null);
        const incomplete = buildRecapModel({ chapter, results: [], complete: false,
            next: { ...next, unlocked: false } });
        assertEqual(incomplete.kicker, 'Ende von Kapitel 1.1');
        assert(incomplete.lockedHint.includes('1.2'), 'locked hint names the next chapter');
        assertEqual(incomplete.hardTexts, []);
        assertEqual(buildRecapModel({ chapter, results, complete: true, replay: true }).kicker,
            'Kapitel 1.1 · Wiederholung');
    });
}
