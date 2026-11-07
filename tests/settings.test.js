import { test, assertEqual } from './assert.js';
import { DAILY_GOAL_CHOICES, DEFAULT_DAILY_GOAL, SETTINGS_KEYS, parseDailyGoal, goalProgress,
    settingsRows, loadDailyGoal, saveDailyGoal, loadTimeChallenge, saveTimeChallenge } from '../js/settings.js';

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
        assertEqual(rows.map(r => r.key), ['sound', 'speech', 'buildUp', 'prompt', 'timer']);
        assertEqual(rows.map(r => r.label), ['Ton', 'Aussprache', 'Satz aufbauen', 'Hörübung', 'Zeitdruck']);
        assertEqual(rows.map(r => r.checked), [true, true, false, false, true]);
        assertEqual(rows.every(r => !r.disabled && r.help.length > 0), true);
        assertEqual(rows[2].help, 'Nach jedem Teil hörst du den Satz bis hierher.');
        const missing = settingsRows({ ...state, buildUp: true, prompt: true, voice: 'missing' });
        assertEqual(missing.map(r => r.disabled), [false, true, true, true, false]);
        assertEqual(missing.map(r => r.checked), [true, false, false, false, true]);
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
}
