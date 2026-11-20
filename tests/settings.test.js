import { test, assertEqual } from './assert.js';
import { DAILY_GOAL_CHOICES, DEFAULT_DAILY_GOAL, SETTINGS_KEYS, parseDailyGoal, goalProgress,
    settingsRows, loadDailyGoal, saveDailyGoal, loadTimeChallenge, saveTimeChallenge,
    getLadderWrite, setLadderWrite, getLadderSpeak, setLadderSpeak, getRecognitionChoice, setRecognitionChoice,
    ladderEnv } from '../js/settings.js';

function memoryStorage(init = {}) {
    const data = { ...init };
    return {
        data,
        getItem: k => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
    };
}

export function runSettingsTests() {
    test('settings: parseDailyGoal accepts only the offered choices', () => {
        assertEqual(DEFAULT_DAILY_GOAL, 10);
        assertEqual(DAILY_GOAL_CHOICES.includes(DEFAULT_DAILY_GOAL), true);
        assertEqual(parseDailyGoal('20'), 20);
        assertEqual(parseDailyGoal(5), 5);
        assertEqual(parseDailyGoal(null), 10);
        assertEqual(parseDailyGoal(''), 10);
        assertEqual(parseDailyGoal('abc'), 10);
        assertEqual(parseDailyGoal('7'), 10);
        assertEqual(parseDailyGoal(-5), 10);
    });

    test('settings: goalProgress caps the ring and flags the reached goal', () => {
        assertEqual(goalProgress(0, 10), { count: 0, goal: 10, fraction: 0, reached: false, label: 'Sätze heute' });
        assertEqual(goalProgress(5, 20).fraction, 0.25);
        assertEqual(goalProgress(10, 10), { count: 10, goal: 10, fraction: 1, reached: true, label: 'Tagesziel erreicht' });
        assertEqual(goalProgress(14, 10).fraction, 1);
        assertEqual(goalProgress(14, 10).count, 14);
        assertEqual(goalProgress(3, 0).goal, DEFAULT_DAILY_GOAL);
    });

    test('settings: settingsRows greys the speech rows without a German voice', () => {
        const state = { sound: true, speech: true, buildUp: false, prompt: false, timer: true, voice: 'ok' };
        const rows = settingsRows(state);
        assertEqual(rows.map(r => r.key), ['sound', 'speech', 'buildUp', 'prompt', 'ladderWrite', 'ladderSpeak', 'speechRecognition', 'timer']);
        assertEqual(rows.map(r => r.label), ['Ton', 'Aussprache', 'Satz aufbauen', 'Hörübung', 'Schreiben üben', 'Sprechen üben', 'Spracherkennung', 'Zeitdruck']);
        assertEqual(rows.map(r => r.checked), [true, true, false, false, true, true, false, true]);
        assertEqual(rows.every(r => r.help.length > 0), true);
        assertEqual(rows.map(r => r.disabled), [false, false, false, false, false, false, true, false]); // no recognition by default
        assertEqual(rows[2].help, 'Nach jedem Teil hörst du den Satz bis hierher.');
        const missing = settingsRows({ ...state, buildUp: true, prompt: true, voice: 'missing' });
        assertEqual(missing.map(r => r.disabled), [false, true, true, true, true, false, true, false]);
        assertEqual(missing.map(r => r.checked), [true, false, false, false, false, true, false, true]);
        assertEqual(settingsRows({ ...state, voice: 'unknown' })[1].disabled, false);
    });

    test('settings: "Satz aufbauen" is greyed while Aussprache is off', () => {
        const state = { sound: true, speech: true, buildUp: true, prompt: false, timer: false, voice: 'ok' };
        assertEqual(settingsRows(state)[2], { key: 'buildUp', label: 'Satz aufbauen',
            help: 'Nach jedem Teil hörst du den Satz bis hierher.', checked: true, disabled: false });
        const off = settingsRows({ ...state, speech: false })[2];
        assertEqual([off.checked, off.disabled], [false, true]);
        assertEqual(settingsRows({ ...state, speech: false })[3].disabled, false); // Hörübung: voice only
    });

    test('settings: daily goal and time challenge round-trip through storage', () => {
        const storage = memoryStorage();
        assertEqual(loadDailyGoal(storage), 10);
        assertEqual(loadTimeChallenge(storage), false);
        saveDailyGoal(30, storage);
        saveTimeChallenge(true, storage);
        assertEqual(storage.data[SETTINGS_KEYS.dailyGoal], '30');
        assertEqual(storage.data[SETTINGS_KEYS.timeChallenge], 'true');
        assertEqual(loadDailyGoal(storage), 30);
        assertEqual(loadTimeChallenge(storage), true);
        saveDailyGoal(12, storage); // not a choice → default
        assertEqual(loadDailyGoal(storage), 10);
        const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        assertEqual(loadDailyGoal(blocked), 10);
        saveDailyGoal(20, blocked); // must not throw
    });

    test('settings: ladder write/speak default on, recognition unasked; round-trip', () => {
        const st = memoryStorage();
        assertEqual([getLadderWrite(st), getLadderSpeak(st), getRecognitionChoice(st)], [true, true, null]);
        setLadderWrite(st, false);
        setLadderSpeak(st, false);
        assertEqual(st.data.ladderWrite, 'false');
        assertEqual([getLadderWrite(st), getLadderSpeak(st)], [false, false]);
        setLadderWrite(st, true);
        assertEqual(getLadderWrite(st), true);
        setRecognitionChoice(st, 'on');
        assertEqual(getRecognitionChoice(st), 'on');
        setRecognitionChoice(st, 'off');
        assertEqual(getRecognitionChoice(st), 'off');
        assertEqual(getRecognitionChoice(memoryStorage({ speechRecognition: 'x' })), null);
        assertEqual(ladderEnv({ storage: st, hasVoice: false }), { voice: false, write: true, speak: false });
        assertEqual(ladderEnv({ storage: memoryStorage(), hasVoice: true }), { voice: true, write: true, speak: true });
    });

    test('settings: rows for Schreiben, Sprechen and Spracherkennung', () => {
        const state = { sound: true, speech: true, buildUp: false, prompt: false, timer: false, voice: 'ok',
            write: true, speak: false, recognition: 'on', speechAvailable: true };
        const rows = settingsRows(state);
        assertEqual(rows.map(r => r.label).slice(4, 7), ['Schreiben üben', 'Sprechen üben', 'Spracherkennung']);
        assertEqual(rows.map(r => r.label)[7], 'Zeitdruck');
        assertEqual(rows.slice(4, 7).map(r => r.key), ['ladderWrite', 'ladderSpeak', 'speechRecognition']);
        assertEqual(rows.slice(4, 7).map(r => r.help), ['Sätze hören und schreiben.', 'Sätze laut sagen.',
            'Die Aufnahme geht zur Erkennung an Google.']);
        assertEqual(rows.slice(4, 7).map(r => r.checked), [true, false, true]);
        assertEqual(rows.slice(4, 7).map(r => r.disabled), [false, false, false]);
        const no = settingsRows({ ...state, voice: 'missing', speechAvailable: false });
        assertEqual(no.slice(4, 7).map(r => r.disabled), [true, false, true]);
        assertEqual(no[6].checked, false);
        assertEqual(settingsRows({ ...state, recognition: null })[6].checked, false);
    });
}
