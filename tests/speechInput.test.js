import { test, assertEqual } from './assert.js';
import { speechAvailable, listen } from '../js/speechInput.js';

/** Fake window with a recogniser class; every instance lands in `made`. */
function fakeWin({ throwOnStart = false } = {}) {
    const made = [];
    class FakeRecognition {
        constructor() { this.calls = []; made.push(this); }
        start() { this.calls.push('start'); if (throwOnStart) throw new Error('busy'); }
        abort() { this.calls.push('abort'); }
        stop() { this.calls.push('stop'); }
        // test drivers
        fireResult(alts) {
            const result = alts.map(t => ({ transcript: t, confidence: 0.9 }));
            result.isFinal = true;
            this.onresult?.({ resultIndex: 0, results: [result] });
        }
        fireError(error) { this.onerror?.({ error }); }
        fireEnd() { this.onend?.(); }
    }
    return { made, win: { webkitSpeechRecognition: FakeRecognition } };
}

export function runSpeechInputTests() {
    test('speechInput: speechAvailable needs a (webkit) SpeechRecognition constructor', () => {
        assertEqual(speechAvailable({}), false);
        assertEqual(speechAvailable({ SpeechRecognition: function () {} }), true);
        assertEqual(speechAvailable({ webkitSpeechRecognition: function () {} }), true);
        assertEqual(speechAvailable({ SpeechRecognition: 'x' }), false);
    });
    test('listen: configures and starts the recogniser', () => {
        const { made, win } = fakeWin();
        listen({ win, maxAlternatives: 4 });
        const r = made[0];
        assertEqual([r.lang, r.interimResults, r.maxAlternatives, r.continuous, r.calls],
            ['de-DE', false, 4, false, ['start']]);
    });
    test('listen: result then end settles once with the alternatives', () => {
        const { made, win } = fakeWin();
        const h = listen({ win });
        assertEqual(h.outcome, null);
        made[0].fireResult(['Ich bin müde', ' ich bin Müde ']);
        made[0].fireEnd();
        assertEqual(h.outcome, { heard: ['Ich bin müde', 'ich bin Müde'], error: null });
    });
    test('listen: no-speech error then end → no-speech', () => {
        const { made, win } = fakeWin();
        const h = listen({ win });
        made[0].fireError('no-speech');
        made[0].fireEnd();
        assertEqual(h.outcome, { heard: [], error: 'no-speech' });
    });
    test('listen: not-allowed and network errors are passed on', () => {
        for (const code of ['not-allowed', 'network']) {
            const { made, win } = fakeWin();
            const h = listen({ win });
            made[0].fireError(code);
            assertEqual(h.outcome, { heard: [], error: code });
        }
    });
    test('listen: end alone → no-result', () => {
        const { made, win } = fakeWin();
        const h = listen({ win });
        made[0].fireEnd();
        assertEqual(h.outcome, { heard: [], error: 'no-result' });
    });
    test('listen: abort() aborts the recogniser → aborted; later events change nothing', () => {
        const { made, win } = fakeWin();
        const h = listen({ win });
        h.abort();
        assertEqual(made[0].calls, ['start', 'abort']);
        made[0].fireResult(['Hallo']);
        made[0].fireEnd();
        assertEqual(h.outcome, { heard: [], error: 'aborted' });
    });
    test('listen: a late result after the end is ignored', () => {
        const { made, win } = fakeWin();
        const h = listen({ win });
        made[0].fireEnd();
        made[0].fireResult(['Hallo']);
        assertEqual(h.outcome, { heard: [], error: 'no-result' });
    });
    test('listen: start() throwing or no recogniser → start-failed', () => {
        const { win } = fakeWin({ throwOnStart: true });
        assertEqual(listen({ win }).outcome, { heard: [], error: 'start-failed' });
        assertEqual(listen({ win: {} }).outcome, { heard: [], error: 'start-failed' });
    });
    test('listen: result is a promise', () => {
        const { win } = fakeWin();
        const h = listen({ win });
        assertEqual(typeof h.result.then, 'function');
        h.abort();
    });
}
