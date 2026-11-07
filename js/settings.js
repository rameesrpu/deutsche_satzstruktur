// Learner settings ("Einstellungen", reached from Home's gear button) and the
// persisted settings that are not owned by SoundManager: the daily goal and the
// time challenge. Sound / speech / audio fill-in-the-blank live in SoundManager
// (gameSoundEnabled / gameSpeechEnabled / gamePromptEnabled); the app routes
// every change from this screen and from the Werkstatt panel through one setter
// (DeutschApp.setLearnerSetting), so both surfaces always show the same state.
// The pure helpers at the top are unit-tested (tests/settings.test.js).

/** Daily goal choices (sentences per day). */
export const DAILY_GOAL_CHOICES = [5, 10, 20, 30];
export const DEFAULT_DAILY_GOAL = 10;

/** localStorage keys owned by this module. */
export const SETTINGS_KEYS = { dailyGoal: 'dailyGoal', timeChallenge: 'gameTimeChallenge' };

// --- Pure helpers ---

/**
 * Stored daily goal → one of DAILY_GOAL_CHOICES (anything else → the default).
 * @param {?string|number} raw
 * @returns {number}
 */
export function parseDailyGoal(raw) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    return DAILY_GOAL_CHOICES.includes(n) ? n : DEFAULT_DAILY_GOAL;
}

/**
 * Today's count against the goal.
 * @param {number} count  sentences played today
 * @param {number} goal
 * @returns {{count: number, goal: number, fraction: number, reached: boolean, label: string}}
 */
export function goalProgress(count, goal) {
    const g = goal > 0 ? goal : DEFAULT_DAILY_GOAL;
    const c = Math.max(0, count | 0);
    const reached = c >= g;
    return {
        count: c, goal: g, fraction: Math.min(c / g, 1), reached,
        label: reached ? 'Tagesziel erreicht' : 'Sätze heute',
    };
}

/**
 * Rows of the learner settings screen.
 * @param {{sound: boolean, speech: boolean, prompt: boolean, timer: boolean, voice: string}} state
 *   voice = SoundManager.voiceStatus ('unknown' | 'ok' | 'missing')
 * @returns {{key: string, label: string, help: string, checked: boolean, disabled: boolean}[]}
 */
export function settingsRows({ sound, speech, prompt, timer, voice }) {
    const noVoice = voice === 'missing';
    return [
        { key: 'sound', label: 'Ton', help: 'Kurze Klänge bei richtig und falsch.',
            checked: sound, disabled: false },
        { key: 'speech', label: 'Aussprache', help: 'Deutsche Wörter werden vorgelesen.',
            checked: !noVoice && speech, disabled: noVoice },
        { key: 'prompt', label: 'Hörübung', help: 'Du hörst den Satz – an der Lücke stoppt er.',
            checked: !noVoice && prompt, disabled: noVoice },
        { key: 'timer', label: 'Zeitdruck', help: 'Schneller platzieren gibt mehr Punkte.',
            checked: timer, disabled: false },
    ];
}

// --- Storage ---

function read(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
}
function write(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { /* storage blocked: keep in memory */ }
}

export function loadDailyGoal(storage = globalThis.localStorage) {
    return parseDailyGoal(read(storage, SETTINGS_KEYS.dailyGoal));
}
export function saveDailyGoal(goal, storage = globalThis.localStorage) {
    write(storage, SETTINGS_KEYS.dailyGoal, String(parseDailyGoal(goal)));
}
export function loadTimeChallenge(storage = globalThis.localStorage) {
    return read(storage, SETTINGS_KEYS.timeChallenge) === 'true';
}
export function saveTimeChallenge(on, storage = globalThis.localStorage) {
    write(storage, SETTINGS_KEYS.timeChallenge, on ? 'true' : 'false');
}

// --- DOM ---

const BACK_ICON = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (k === 'html') node.innerHTML = v; // static icon markup only
        else if (k in node) node[k] = v;
        else node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
}

/**
 * Einstellungen: Ton, Aussprache, Hörübung, Zeitdruck, Tagesziel.
 * @param {HTMLElement} root
 * @param {{sound: boolean, speech: boolean, prompt: boolean, timer: boolean, voice: string,
 *   dailyGoal: number}} state
 * @param {{set: function(string, (boolean|number)), back: function()}} actions
 *   set('sound'|'speech'|'prompt'|'timer', bool) or set('dailyGoal', n)
 */
export function renderSettings(root, state, actions) {
    const rows = settingsRows(state);
    const list = el('ul', { className: 'home-card settings-list' }, rows.map(row => {
        const id = `learner-${row.key}-toggle`;
        return el('li', { className: `settings-row${row.disabled ? ' is-unavailable' : ''}` },
            el('label', { className: 'settings-row-text', htmlFor: id },
                el('span', { className: 'settings-row-label' }, row.label),
                el('span', { className: 'home-muted' }, row.help)),
            el('input', {
                type: 'checkbox', id, className: 'settings-switch', role: 'switch',
                checked: row.checked, disabled: row.disabled,
                onchange: e => actions.set(row.key, e.target.checked),
            }));
    }));

    const parts = [
        el('header', { className: 'screen-head screen-head-row' },
            el('button', { type: 'button', className: 'screen-icon-btn', 'aria-label': 'Zurück',
                onclick: () => actions.back(), html: BACK_ICON }),
            el('h1', { className: 'screen-title' }, 'Einstellungen')),
        el('section', { className: 'home-chapters' },
            el('div', { className: 'home-section-head' }, el('h3', {}, 'Spiel')),
            list,
            state.voice === 'missing' ? el('p', { className: 'settings-hint' },
                'Keine deutsche Stimme auf diesem Gerät – Aussprache und Hörübung sind aus. ' +
                'Installiere eine deutsche Sprachausgabe oder nutze einen anderen Browser.') : null),
        el('section', { className: 'home-chapters' },
            el('div', { className: 'home-section-head' }, el('h3', {}, 'Tagesziel')),
            el('div', { className: 'home-card settings-goal' },
                el('span', { className: 'home-muted', id: 'settings-goal-help' }, 'Wie viele Sätze möchtest du pro Tag spielen?'),
                el('div', { className: 'settings-goal-choices', role: 'radiogroup', 'aria-labelledby': 'settings-goal-help' },
                    DAILY_GOAL_CHOICES.map(n => el('button', {
                        type: 'button', role: 'radio',
                        className: `settings-goal-btn${n === state.dailyGoal ? ' is-selected' : ''}`,
                        'aria-checked': n === state.dailyGoal ? 'true' : 'false',
                        'aria-label': `${n} Sätze`,
                        onclick: () => actions.set('dailyGoal', n),
                    }, String(n)))))),
    ];
    root.replaceChildren(el('div', { className: 'screen-inner' }, parts));
}
