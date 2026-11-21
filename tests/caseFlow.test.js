// caseFlow: the Anamnese data file (sections and standard questions); cases follow in Task 3

import { test, assert, assertEqual } from './assert.js';
import { readText } from './stubs.js';
import { ANAMNESE_VERSION } from '../js/klinik.js';

const SECTIONS = [
    ['beschwerden', 'Aktuelle Beschwerden'], ['vorerkrankungen', 'Vorerkrankungen und Operationen'],
    ['medikamente', 'Medikamente'], ['allergien', 'Allergien'], ['vegetativ', 'Vegetative Anamnese'],
    ['familie', 'Familienanamnese'], ['sozial', 'Sozialanamnese'],
];

export function runCaseFlowTests() {
    const data = JSON.parse(readText('data/medical/anamnese.json'));

    test('anamnese.json: version mirrored by ANAMNESE_VERSION', () => {
        assertEqual(data.version, ANAMNESE_VERSION);
    });

    test('anamnese.json: seven sections in interview order', () => {
        assertEqual(data.sections.map(s => [s.id, s.title]), SECTIONS);
        for (const s of data.sections) assert(typeof s.en === 'string' && s.en.trim() !== '', `${s.id}: en`);
    });

    test('anamnese.json: 6 to 8 questions per section', () => {
        for (const s of data.sections) {
            assert(s.questions.length >= 6 && s.questions.length <= 8, `${s.id}: ${s.questions.length} questions`);
        }
    });

    test('anamnese.json: question ids unique, de ends with ?, en non-empty, also ids are other sections', () => {
        const ids = new Set();
        const sectionIds = data.sections.map(s => s.id);
        for (const s of data.sections) {
            for (const q of s.questions) {
                assert(!ids.has(q.id), `duplicate id ${q.id}`);
                ids.add(q.id);
                assert(typeof q.de === 'string' && q.de.trim().endsWith('?'), `${q.id}: de ends with ?`);
                assert(typeof q.en === 'string' && q.en.trim() !== '', `${q.id}: en`);
                for (const a of q.also || []) {
                    assert(sectionIds.includes(a) && a !== s.id, `${q.id}: also ${a}`);
                }
            }
        }
    });

    test('anamnese.json: the standard Sozialanamnese question about alcohol is there', () => {
        const sozial = data.sections.find(s => s.id === 'sozial');
        assert(sozial.questions.some(q => q.de === 'Trinken Sie Alkohol?'));
    });
}
