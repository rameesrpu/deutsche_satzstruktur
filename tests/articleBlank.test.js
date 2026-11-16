// articleBlank: pure logic of rung 3 (which articles to blank until the phrase is placed)

import { tagged } from './stubs.js';
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
}
