// articleBlank: pure logic of rung 3 (which articles to blank until the phrase is placed)

import { tagged, libWords } from './stubs.js';
import { test, assert, assertEqual } from './assert.js';
import { ARTICLES, articleIndexes, blankArticles, hasArticle } from '../js/articleBlank.js';

const give = () => tagged('Ich gebe dem Patienten einen Tee.', 'S.ich V.ich O.m.dat O.m.dat O.m.akk O.m.akk');

export function runArticleBlankTests() {
    test('ARTICLES: definite, indefinite and kein- forms', () => {
        assert(ARTICLES.has('der') && ARTICLES.has('einem') && ARTICLES.has('keines'), 'forms missing');
        assert(!ARTICLES.has('mein'), 'possessive is not an article');
    });
    test('articleIndexes: article before its noun', () =>
        assertEqual(articleIndexes(give()), [2, 4]));
    test('blankArticles: from the start', () =>
        assertEqual(blankArticles(give(), 0), ['Ich', 'gebe', '___', 'Patienten', '___', 'Tee.']));
    test('blankArticles: only from fromIndex on', () =>
        assertEqual(blankArticles(give(), 4), ['Ich', 'gebe', 'dem', 'Patienten', '___', 'Tee.']));
    test('lone pronoun "Die" is not blanked', () => {
        const words = tagged('Die ist neu.', 'S.sie V.sie X');
        assertEqual(articleIndexes(words), []);
        assert(!hasArticle(words), 'no article');
    });
    test('contraction "im" stays: no article', () =>
        assert(!hasArticle(tagged('Ich wohne im Zentrum.', 'S.ich V.ich P O.n.dat')), 'im is no article'));
    test('possessive "mein" and lone "Das" are not blanked', () =>
        assertEqual(articleIndexes(tagged('Das ist mein Bruder.', 'S.er V.er S.m S.m')), []));
    test('capitalised sentence start is blanked', () => {
        const words = tagged('Der Arzt kommt.', 'S.m S.m V.er');
        assertEqual(articleIndexes(words), [0]);
        assertEqual(blankArticles(words, 0)[0], '___');
    });
    test('blankArticles keeps punctuation around the article', () =>
        assertEqual(blankArticles(tagged('„Die Ärztin kommt.“', 'S.f S.f V.sie'), 0)[0], '„___'));
    test('hasArticle: sentence with an article', () => assert(hasArticle(give()), 'has article'));

    // Word shapes copied from data/library (raw types, adjectives between article and noun)
    const apotheke = () => libWords([['Wo', 'other', 'nom', 'none'], ['ist', 'verb', 'nom', 'none'],
        ['die', 'subject', 'nom', 'f'], ['nächste', 'adjective', 'nom', 'f'], ['Apotheke?', 'subject', 'nom', 'f']]);
    const haus = () => libWords([['Sie', 'subject', 'nom', 'none'], ['haben', 'verb', 'nom', 'none'],
        ['ein', 'object-akk', 'akk', 'n'], ['großes', 'adjective', 'akk', 'n'], ['Haus.', 'object-akk', 'akk', 'n']]);
    const buero = () => libWords([['Er', 'subject', 'nom', 'm'], ['arbeitet', 'verb', 'nom', 'none'],
        ['in', 'preposition', 'nom', 'none'], ['einem', 'object-dat', 'dat', 'n'], ['Büro.', 'object-dat', 'dat', 'n']]);
    const restaurant = () => libWords([['Das', 'subject', 'nom', 'n'], ['ist', 'verb', 'nom', 'none'],
        ['das', 'subject', 'nom', 'n'], ['beste', 'adjective', 'nom', 'n'], ['Restaurant', 'subject', 'nom', 'n'],
        ['in', 'preposition', 'nom', 'none'], ['der', 'object', 'dat', 'f'], ['Stadt.', 'object', 'dat', 'f']]);
    test('articleIndexes: article before an adjective and its noun', () => {
        assertEqual(articleIndexes(apotheke()), [2]);
        assertEqual(blankArticles(apotheke(), 0), ['Wo', 'ist', '___', 'nächste', 'Apotheke?']);
    });
    test('articleIndexes: legacy object-akk / object-dat types count as noun phrase words', () => {
        assertEqual(articleIndexes(haus()), [2]);
        assertEqual(articleIndexes(buero()), [3]);
    });
    test('articleIndexes: both articles of "das beste Restaurant in der Stadt", the lone "Das" stays', () =>
        assertEqual(blankArticles(restaurant(), 0),
            ['Das', 'ist', '___', 'beste', 'Restaurant', 'in', '___', 'Stadt.']));
    test('articleIndexes: up to two adjectives between article and noun, not three', () => {
        const adj = n => libWords([['Das', 'subject', 'nom', 'n'], ['ist', 'verb', 'nom', 'none'], ['ein', 'subject', 'nom', 'n'],
            ...Array.from({ length: n }, (_, i) => [`a${i}`, 'adjective', 'nom', 'n']), ['Haus.', 'subject', 'nom', 'n']]);
        assertEqual(articleIndexes(adj(2)), [2]);
        assertEqual(articleIndexes(adj(3)), []);
    });
    test('articleIndexes: an adjective run that ends in another case or gender is no phrase', () =>
        assertEqual(articleIndexes(libWords([['Die', 'subject', 'nom', 'f'], ['ist', 'verb', 'nom', 'none'],
            ['neu', 'adjective', 'nom', 'f'], ['Haus.', 'object', 'akk', 'n']])), []));
}
