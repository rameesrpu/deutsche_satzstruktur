// speakScreen: pure logic of rung 5 "Sprechen"

import { test, assert, assertEqual } from './assert.js';
import { makeLocalStorage } from './stubs.js';
import { SPEECH_TRIES, CUE_MS, speakMode, speakStep, fallbackNote, renderSpeakScreen } from '../js/speakScreen.js';

/** Just enough DOM for renderSpeakScreen: elements with children, text and click handlers. */
function fakeElement(tag) {
    const handlers = {};
    const node = {
        tagName: tag.toUpperCase(), children: [], attrs: {}, className: '', textContent: '', hidden: false,
        classList: { toggle() {} },
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
        click() { for (const fn of handlers.click || []) fn(); },
        focus() {},
        append(...kids) { for (const k of kids) this.children.push(typeof k === 'string' ? { textContent: k, children: [] } : k); },
        appendChild(k) { this.append(k); return k; },
        replaceChildren(...kids) { this.children = []; this.append(...kids); },
        replaceWith() {},
        querySelector() { return null; },
    };
    return node;
}
const allNodes = n => [n, ...(n.children || []).flatMap(allNodes)];
const findButton = (root, text) => allNodes(root).find(n => n.tagName === 'BUTTON' && n.textContent === text);


const PASS = { pass: true };
const FAIL = { pass: false };

export function runSpeakScreenTests() {
    test('speakScreen: constants', () => {
        assertEqual(SPEECH_TRIES, 3);
        assertEqual(CUE_MS, 4000);
    });
    test('speakMode: unavailable or off → self, on → recognise, unasked → ask', () => {
        assertEqual(speakMode({ available: false, choice: null }), 'self');
        assertEqual(speakMode({ available: false, choice: 'on' }), 'self');
        assertEqual(speakMode({ available: true, choice: 'off' }), 'self');
        assertEqual(speakMode({ available: true, choice: 'on' }), 'recognise');
        assertEqual(speakMode({ available: true, choice: null }), 'ask');
    });
    test('speakStep: pass on the first try is done and ok', () => {
        assertEqual(speakStep({ tries: 0 }, PASS, null), { tries: 1, done: true, ok: true, fallback: false });
    });
    test('speakStep: three fails are done and not ok on the third', () => {
        const a = speakStep({ tries: 0 }, FAIL, null);
        assertEqual(a, { tries: 1, done: false, ok: false, fallback: false });
        const b = speakStep(a, FAIL, null);
        assertEqual(b, { tries: 2, done: false, ok: false, fallback: false });
        assertEqual(speakStep(b, FAIL, null), { tries: 3, done: true, ok: false, fallback: false });
    });
    test('speakStep: fail then pass is ok', () => {
        assertEqual(speakStep({ tries: 2 }, PASS, null), { tries: 3, done: true, ok: true, fallback: false });
    });
    test('speakStep: no-speech, no-result and aborted do not count a try', () => {
        for (const err of ['no-speech', 'no-result', 'aborted']) {
            assertEqual(speakStep({ tries: 1 }, FAIL, err), { tries: 1, done: false, ok: false, fallback: false }, err);
        }
    });
    test('speakStep: not-allowed and other errors fall back to the self-check', () => {
        for (const err of ['not-allowed', 'network', 'start-failed']) {
            assertEqual(speakStep({ tries: 1 }, FAIL, err), { tries: 1, done: false, ok: false, fallback: true }, err);
        }
    });
    // F7: refused microphone permission
    test('speakMode: a blocked microphone → self-check from the start', () => {
        assertEqual(speakMode({ available: true, choice: 'on', blocked: true }), 'self');
        assertEqual(speakMode({ available: true, choice: 'on', blocked: false }), 'recognise');
    });
    test('fallbackNote: refused permission has its own line', () => {
        assertEqual(fallbackNote('not-allowed'), 'Kein Zugriff aufs Mikrofon. Prüf dich selbst.');
        assertEqual(fallbackNote('service-not-allowed'), 'Kein Zugriff aufs Mikrofon. Prüf dich selbst.');
        assertEqual(fallbackNote('network'), 'Die Erkennung geht gerade nicht. Prüf dich selbst.');
    });
    // F11: privacy — no recognition before she chooses
    test('renderSpeakScreen: ask mode does not start recognition before a choice', () => {
        const saved = globalThis.document.createElement;
        globalThis.document.createElement = fakeElement;
        try {
            let created = 0, started = 0;
            const win = { SpeechRecognition: class { constructor() { created++; } start() { started++; } abort() {} } };
            const storage = makeLocalStorage();
            const root = fakeElement('div');
            const teardown = renderSpeakScreen(root, { text: 'Ich bin neu.', translation: 'I am new.', total: 1, index: 0, storage, win },
                { onDone() {}, onClose() {} });
            assert(findButton(root, 'Einverstanden'), 'privacy card shown');
            assertEqual([created, started], [0, 0]);
            findButton(root, 'Einverstanden').click();
            assertEqual([created, started], [0, 0]);           // the mic waits for a tap
            allNodes(root).find(n => n.className === 'speak-mic').click();
            assertEqual([created, started], [1, 1]);
            teardown();
        } finally {
            globalThis.document.createElement = saved;
        }
    });
}
