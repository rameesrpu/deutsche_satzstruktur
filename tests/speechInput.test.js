import { test, assertEqual } from './assert.js';
import { speechAvailable } from '../js/speechInput.js';

export function runSpeechInputTests() {
    test('speechInput: speechAvailable needs a (webkit) SpeechRecognition constructor', () => {
        assertEqual(speechAvailable({}), false);
        assertEqual(speechAvailable({ SpeechRecognition: function () {} }), true);
        assertEqual(speechAvailable({ webkitSpeechRecognition: function () {} }), true);
        assertEqual(speechAvailable({ SpeechRecognition: 'x' }), false);
    });
}
