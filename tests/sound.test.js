import { test, testAsync, assert, assertEqual } from './assert.js';
import { makeLocalStorage } from './stubs.js';
import { SoundManager, findGermanVoice, placementSpeech, promptStartIndex } from '../js/sound.js';

/** Fake speechSynthesis: voices can change later via setVoices(). */
function fakeSynth(voices) {
    const listeners = [];
    return {
        getVoices: () => voices,
        addEventListener: (type, fn) => { if (type === 'voiceschanged') listeners.push(fn); },
        setVoices(v) { voices = v; listeners.forEach(fn => fn()); },
    };
}

function detect(synth) {
    const sm = new SoundManager();
    const changes = [];
    let timer = null;
    sm.detectGermanVoice(s => changes.push(s), { synth, setTimer: fn => { timer = fn; } });
    return { sm, changes, fireTimeout: () => timer && timer() };
}

const en = { lang: 'en-US', name: 'English' };
const de = { lang: 'de-DE', name: 'Deutsch' };

export function runSoundTests() {
    test('sound: findGermanVoice matches de-* (any case), else null', () => {
        assertEqual(findGermanVoice([en, de]), de);
        assertEqual(findGermanVoice([{ lang: 'DE_at' }])?.lang, 'DE_at');
        assertEqual(findGermanVoice([en]), null);
        assertEqual(findGermanVoice(undefined), null);
    });

    test('sound: German voice available right away → ok', () => {
        const { sm, changes } = detect(fakeSynth([en, de]));
        assertEqual(changes, ['ok']);
        assertEqual(sm.germanVoice, de);
        assertEqual(sm.speechAvailable, true);
    });

    test('sound: voices loaded without German → missing; speak() is skipped', () => {
        const { sm, changes } = detect(fakeSynth([en]));
        assertEqual(changes, ['missing']);
        assertEqual(sm.speechAvailable, false);
        sm.speak('Hallo'); // would throw on the missing SpeechSynthesisUtterance stub
        assertEqual(sm.lastSpoken, undefined);
    });

    test('sound: empty list waits for voiceschanged, then settles', () => {
        const synth = fakeSynth([]);
        const { changes, fireTimeout } = detect(synth);
        assertEqual(changes, []);
        synth.setVoices([en, de]);
        fireTimeout();
        assertEqual(changes, ['ok']);
    });

    test('sound: no voices ever → missing after timeout; a later voice re-enables', () => {
        const synth = fakeSynth([]);
        const { sm, changes, fireTimeout } = detect(synth);
        fireTimeout();
        assertEqual(changes, ['missing']);
        synth.setVoices([de]);
        assertEqual(changes, ['missing', 'ok']);
        assertEqual(sm.speechAvailable, true);
    });

    test('sound: no speechSynthesis at all → missing', () => {
        const sm = new SoundManager();
        const changes = [];
        sm.detectGermanVoice(s => changes.push(s), { synth: null });
        assertEqual(changes, ['missing']);
    });

    test('sound: placementSpeech speaks only the placed phrase by default', () => {
        const texts = ['Ayisha', 'ist', 'Ärztin.'];
        assertEqual(placementSpeech({ texts, range: [0, 0], endIdx: 0, buildUp: false }), 'Ayisha');
        assertEqual(placementSpeech({ texts, range: [1, 1], endIdx: 1, buildUp: false }), 'ist');
        assertEqual(placementSpeech({ texts, range: [2, 2], endIdx: 2, buildUp: false }), 'Ärztin');
        // a phrase box: all its words, trailing punctuation stripped; auto-words not included
        const box = ['Heute', 'arbeitet', 'sie', 'im', 'Krankenhaus,', 'oder?'];
        assertEqual(placementSpeech({ texts: box, range: [3, 4], endIdx: 5, buildUp: false }), 'im Krankenhaus');
        assertEqual(placementSpeech({ texts: ['Wie', 'geht', 'es', 'dir?'], range: [3, 3], endIdx: 3, buildUp: false }), 'dir');
    });

    test('sound: placementSpeech with "Satz aufbauen" speaks the growing prefix', () => {
        const texts = ['Ayisha', 'ist', 'Ärztin.'];
        assertEqual(placementSpeech({ texts, range: [0, 0], endIdx: 0, buildUp: true }), 'Ayisha,');
        assertEqual(placementSpeech({ texts, range: [1, 1], endIdx: 1, buildUp: true }), 'Ayisha ist,');
        assertEqual(placementSpeech({ texts, range: [2, 2], endIdx: 2, buildUp: true }), 'Ayisha ist Ärztin.');
        // auto-words revealed after the phrase are included up to endIdx
        assertEqual(placementSpeech({ texts, range: [0, 0], endIdx: 1, buildUp: true }), 'Ayisha ist,');
    });

    test('sound: placementSpeech build-up starts at the clause on long sentences', () => {
        const texts = ['Am', 'Morgen', 'trinkt', 'Ayisha', 'einen', 'Kaffee', 'mit', 'Milch,',
            'dann', 'fährt', 'sie', 'zur', 'Klinik.'];
        assertEqual(promptStartIndex(texts, 9), 8);
        assertEqual(placementSpeech({ texts, range: [9, 9], endIdx: 9, buildUp: true }), 'dann fährt,');
        assertEqual(placementSpeech({ texts, range: [12, 12], endIdx: 12, buildUp: true }), 'dann fährt sie zur Klinik.');
        // short prefix (≤ 8 words before the blank): from the sentence start
        assertEqual(placementSpeech({ texts, range: [2, 2], endIdx: 2, buildUp: true }), 'Am Morgen trinkt,');
        // build-up off ignores clauses: still just the phrase
        assertEqual(placementSpeech({ texts, range: [11, 12], endIdx: 12, buildUp: false }), 'zur Klinik');
    });

    test('sound: build-up and Hörübung are off on fresh storage; stored "true" is kept', () => {
        const saved = globalThis.localStorage;
        try {
            globalThis.localStorage = makeLocalStorage();
            const fresh = new SoundManager();
            assertEqual(fresh.buildUpEnabled, false);
            assertEqual(fresh.promptEnabled, false);
            assertEqual(fresh.speechEnabled, true);
            fresh.setBuildUpEnabled(true);
            assertEqual(localStorage.getItem('gameSpeechBuildUp'), 'true');

            globalThis.localStorage = makeLocalStorage();
            localStorage.setItem('gameSpeechBuildUp', 'true');
            localStorage.setItem('gamePromptEnabled', 'true');
            const kept = new SoundManager();
            assertEqual(kept.buildUpEnabled, true);
            assertEqual(kept.promptEnabled, true);
        } finally {
            globalThis.localStorage = saved;
        }
    });

    test('sound: sentenceAlreadySpoken covers lastSpoken and a playing prompt', () => {
        const sm = new SoundManager();
        assertEqual(sm.sentenceAlreadySpoken('Ayisha ist Ärztin.'), false);
        sm.lastSpoken = 'Ärztin';
        assertEqual(sm.sentenceAlreadySpoken('Ayisha ist Ärztin.'), false);
        sm.lastSpoken = 'Ayisha ist Ärztin.';
        assertEqual(sm.sentenceAlreadySpoken('Ayisha ist Ärztin.'), true);
        sm.lastSpoken = null;
        sm._promptFull = 'Ayisha ist Ärztin.';
        assertEqual(sm.sentenceAlreadySpoken('Ayisha ist Ärztin.'), true);
    });

    test('sound: speak() passes an optional rate (default 0.95)', () => {
        const made = [];
        globalThis.SpeechSynthesisUtterance = function (t) { this.text = t; made.push(this); };
        globalThis.speechSynthesis = { getVoices: () => [de], cancel() {}, speak() {} };
        try {
            const { sm } = detect(fakeSynth([de]));
            sm.speechEnabled = true;
            sm.speak('x');
            sm.speak('y', { rate: 0.7 });
            assertEqual(made.map(u => u.rate), [0.95, 0.7]);
        } finally {
            delete globalThis.SpeechSynthesisUtterance;
            delete globalThis.speechSynthesis;
        }
    });

    test('sound: speak() with force ignores the Aussprache toggle', () => {
        const made = [];
        globalThis.SpeechSynthesisUtterance = function (t) { this.text = t; made.push(this); };
        globalThis.speechSynthesis = { getVoices: () => [de], cancel() {}, speak() {} };
        try {
            const { sm } = detect(fakeSynth([de]));
            sm.speechEnabled = false;
            sm.speak('x');
            sm.speak('y', { force: true });
            assertEqual(made.map(u => u.text), ['y']);
        } finally {
            delete globalThis.SpeechSynthesisUtterance;
            delete globalThis.speechSynthesis;
        }
    });
    // F5: the review start waits briefly for the voice status
    testAsync('sound: whenVoiceSettled resolves at once when known', async () => {
        const sm = new SoundManager();
        sm.voiceStatus = 'ok';
        assertEqual(await sm.whenVoiceSettled({ timeoutMs: 1000 }), 'ok');
    });
    testAsync('sound: whenVoiceSettled waits for the status to settle', async () => {
        const sm = new SoundManager();
        setTimeout(() => { sm.voiceStatus = 'missing'; }, 20);
        assertEqual(await sm.whenVoiceSettled({ timeoutMs: 1000, interval: 5 }), 'missing');
    });
    testAsync('sound: whenVoiceSettled gives up after the timeout', async () => {
        const sm = new SoundManager();
        const t0 = Date.now();
        assertEqual(await sm.whenVoiceSettled({ timeoutMs: 40, interval: 5 }), 'unknown');
        assert(Date.now() - t0 < 500, 'timed out promptly');
    });
}
