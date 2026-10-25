import { test, assertEqual } from './assert.js';
import { SoundManager, findGermanVoice } from '../js/sound.js';

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
}
