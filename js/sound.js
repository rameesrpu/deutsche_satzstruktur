/**
 * SoundManager — synthesized game sounds via Web Audio (no audio assets).
 *
 * Design goals: quiet, short, musical. All tones use fast exponential
 * envelopes (soft attack, quick decay) so nothing rings or buzzes.
 * The "correct" sound climbs a major scale with the current streak,
 * which keeps it from getting repetitive.
 *
 * The AudioContext is created lazily inside a user gesture (placement
 * taps), which satisfies mobile autoplay policies.
 */

/** First German voice in a speechSynthesis.getVoices() list, or null. */
export function findGermanVoice(voices) {
    return (voices || []).find(v => v.lang && v.lang.toLowerCase().startsWith('de')) || null;
}

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('gameSoundEnabled') !== 'false';
        this.speechEnabled = localStorage.getItem('gameSpeechEnabled') !== 'false';
        // Audio fill-in-the-blank mode: play the sentence, pause at the blank
        this.promptEnabled = localStorage.getItem('gamePromptEnabled') !== 'false';
        // Whether this engine fires word-boundary events (detected at runtime;
        // required for pausing full-sentence audio at the blank)
        this.boundarySupported = false;
        this._boundaryProbed = false;
        this._promptFull = null;  // sentence text of the active prompt utterance
        this._pauseAt = null;     // char index to pause at (null = play to end)
        // German TTS voice: 'unknown' until detectGermanVoice() settles, then
        // 'ok' or 'missing' (speech is skipped instead of failing silently)
        this.voiceStatus = 'unknown';
        this.germanVoice = null;
    }

    /** False once we know no German voice exists (speech options unusable). */
    get speechAvailable() {
        return this.voiceStatus !== 'missing';
    }

    /**
     * Look for a German TTS voice. getVoices() is often empty until
     * 'voiceschanged' fires, and engines with no voices at all (e.g. Chrome
     * on Linux without speech-dispatcher) may never fire it — so with an
     * empty list the status settles to 'missing' after timeoutMs.
     * onChange(status) runs on every change, also if a voice shows up later.
     */
    detectGermanVoice(onChange, {
        synth = ('speechSynthesis' in window) ? window.speechSynthesis : null,
        timeoutMs = 3000,
        setTimer = setTimeout,
    } = {}) {
        const setStatus = (status) => {
            if (status === this.voiceStatus) return;
            this.voiceStatus = status;
            if (onChange) onChange(status);
        };
        if (!synth) { setStatus('missing'); return; }
        const check = (final) => {
            const voices = synth.getVoices() || [];
            this.germanVoice = findGermanVoice(voices);
            if (this.germanVoice) setStatus('ok');
            else if (final || voices.length > 0) setStatus('missing');
        };
        if (synth.addEventListener) synth.addEventListener('voiceschanged', () => check(false));
        else synth.onvoiceschanged = () => check(false);
        check(false);
        if (this.voiceStatus === 'unknown') setTimer(() => check(true), timeoutMs);
    }

    setEnabled(on) {
        this.enabled = on;
        localStorage.setItem('gameSoundEnabled', on ? 'true' : 'false');
    }

    setSpeechEnabled(on) {
        this.speechEnabled = on;
        localStorage.setItem('gameSpeechEnabled', on ? 'true' : 'false');
        if (!on) this.cancelPrompt();
    }

    setPromptEnabled(on) {
        this.promptEnabled = on;
        localStorage.setItem('gamePromptEnabled', on ? 'true' : 'false');
        if (!on) this.cancelPrompt();
    }

    /** Drop any active/paused prompt audio (game exit, toggles off). */
    cancelPrompt() {
        this._promptFull = null;
        this._pauseAt = null;
        if ('speechSynthesis' in window) speechSynthesis.cancel();
    }

    /**
     * Silently detect whether the TTS engine fires word-boundary events
     * (volume-0 utterance). Chrome/Edge/Safari desktop and iOS do; some
     * Android voices don't — those get the prefix fallback in
     * promptSentence(). Call from a user gesture (game start).
     */
    probeBoundary() {
        if (this._boundaryProbed || !('speechSynthesis' in window)) return;
        this._boundaryProbed = true;
        const u = new SpeechSynthesisUtterance('Satz Struktur');
        u.volume = 0;
        u.lang = 'de-DE';
        u.onboundary = () => { this.boundarySupported = true; };
        speechSynthesis.speak(u);
    }

    /**
     * Speak German text via the Web Speech API (free, offline-capable).
     * Hearing the word at the moment of placement binds its sound to the
     * grammatical category and grid location.
     */
    speak(text, { queue = false } = {}) {
        if (!this.speechEnabled || !this.speechAvailable || !text || !('speechSynthesis' in window)) return;
        this.lastSpoken = text; // lets callers avoid immediate repeats
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'de-DE';
        u.rate = 0.95;
        const de = this.germanVoice || findGermanVoice(speechSynthesis.getVoices());
        if (de) u.voice = de;
        // Word-level speech replaces whatever is playing (rapid placements
        // shouldn't back up); pass queue: true to wait for the current
        // utterance instead (e.g. full-sentence readout after the last word)
        u.onboundary = () => { this.boundarySupported = true; };
        if (!queue) speechSynthesis.cancel();
        speechSynthesis.speak(u);
    }

    /** Char offset of words[i] within words.join(' '). */
    _charIndexOfWord(words, i) {
        let c = 0;
        for (let j = 0; j < i; j++) c += words[j].length + 1;
        return c;
    }

    /**
     * First word of the clause containing words[i]. Clauses split after
     * words ending in , ; : or at standalone –/— dashes.
     */
    _clauseStart(words, i) {
        const sep = /[,;:]$|^[–—-]$|[–—]$/;
        for (let j = i - 1; j >= 0; j--) {
            if (sep.test(words[j])) return j + 1;
        }
        return 0;
    }

    /**
     * Where prefix speech should start when the blank is words[uptoIndex]:
     * from the sentence start normally, but for long sentences only from the
     * current clause — no need to re-speak clauses already heard.
     */
    promptStartIndex(words, uptoIndex) {
        const LONG = 8; // trim only when the full prefix would exceed this
        if (uptoIndex <= LONG) return 0;
        return this._clauseStart(words, uptoIndex);
    }

    /**
     * Audio fill-in-the-blank: play the sentence and PAUSE right before the
     * blank word, so the learner hears the sentence's real intonation lead
     * into the gap. After a placement, call again with the next blank (or
     * null) — the SAME utterance resumes, keeping the full-sentence melody
     * intact end to end.
     *
     * Engines without word-boundary events (some Android voices) can't pause
     * at the right spot — playing the full text would reveal the answer — so
     * they fall back to speaking only the words before the blank.
     *
     * @param {string[]} words       sentence words in order
     * @param {number|null} blankIndex index of the word to stop before;
     *                                 null = play through to the end
     */
    promptSentence(words, blankIndex) {
        if (!this.promptEnabled || !this.speechEnabled || !this.speechAvailable) return;
        if (!words || words.length === 0 || !('speechSynthesis' in window)) return;

        const full = words.join(' ');
        const pauseAt = blankIndex === null
            ? null
            : this._charIndexOfWord(words, blankIndex);

        if (this.boundarySupported) {
            if (this._promptFull === full) {
                // Same sentence audio: advance the pause point and resume —
                // the engine continues its own synthesis, prosody unbroken
                if (pauseAt === this._pauseAt) return; // redundant call guard
                this._pauseAt = pauseAt;
                if (speechSynthesis.paused) speechSynthesis.resume();
                return;
            }

            speechSynthesis.cancel();
            this._promptFull = full;
            this._pauseAt = pauseAt;

            const u = new SpeechSynthesisUtterance(full);
            u.lang = 'de-DE';
            u.rate = 0.95;
            const de = this.germanVoice || findGermanVoice(speechSynthesis.getVoices());
            if (de) u.voice = de;
            u.onboundary = (e) => {
                this.boundarySupported = true;
                const ci = e.charIndex ?? 0;
                if (this._pauseAt !== null && ci >= this._pauseAt) {
                    speechSynthesis.pause();
                }
            };
            u.onend = () => {
                if (this._promptFull === full) this._promptFull = null;
                this.lastSpoken = full; // dedupes the completion readout
            };
            speechSynthesis.speak(u);
        } else {
            // Fallback: only the words before the blank — and for long
            // sentences only from the current clause, so earlier clauses
            // aren't re-spoken on every placement. speak() carries a
            // boundary detector, so capable engines upgrade automatically.
            const prefix = blankIndex === null
                ? full
                : words.slice(this.promptStartIndex(words, blankIndex), blankIndex).join(' ');
            // Trailing comma biases the engine toward continuation intonation
            // (pitch held up, "more coming") instead of a sentence-final fall
            // on the last word before the blank
            if (prefix) this.speak(blankIndex === null ? prefix : prefix + ',');
        }
    }

    _getCtx() {
        if (!this.enabled) return null;
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    /**
     * Play one tone. Options: start (s offset), dur (s), type (waveform),
     * gain (peak volume, keep ≤ 0.2), glideTo (optional end frequency).
     */
    _tone(freq, { start = 0, dur = 0.18, type = 'sine', gain = 0.15, glideTo = null } = {}) {
        const ctx = this._getCtx();
        if (!ctx) return;

        const t0 = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (glideTo) {
            osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
        }

        // Soft attack, natural decay — no clicks, no ringing
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }

    /**
     * Correct placement: the TILE'S OWN note — pitch is a fixed function of
     * grid position (pentatonic, bottom-left lowest → top-right highest,
     * matching the natural pitch↔space association). Sound thereby encodes
     * the grammatical category itself, like color and location do, and a
     * sentence becomes a repeatable melody. Pentatonic = every possible
     * sequence stays consonant, so it never grates.
     * Falls back to a streak-climbing note if no cell is given.
     */
    correct(streak = 0, row = null, col = null) {
        const base = 392.0; // G4 — clear on phone speakers
        let semis;
        if (row !== null && col !== null) {
            const penta = [0, 2, 4, 7, 9, 12, 14, 16, 19]; // 2 octaves pentatonic
            const idx = (3 - row) * 3 + (col - 1);
            semis = penta[Math.min(Math.max(idx, 0), penta.length - 1)];
        } else {
            const majorScale = [0, 2, 4, 5, 7, 9, 11, 12];
            semis = majorScale[Math.min(Math.max(streak, 0), majorScale.length - 1)];
        }
        const f = base * Math.pow(2, semis / 12);
        this._tone(f, { dur: 0.16, gain: 0.13 });
        this._tone(f * 2, { dur: 0.1, gain: 0.04 }); // faint octave shimmer
    }

    /** Wrong placement: gentle low two-note "uh-oh", not a buzzer */
    wrong() {
        this._tone(196.0, { dur: 0.13, type: 'triangle', gain: 0.11 });          // G3
        this._tone(155.56, { start: 0.09, dur: 0.16, type: 'triangle', gain: 0.09 }); // Eb3
    }

    /** Case button select: barely-there tick */
    select() {
        this._tone(880, { dur: 0.05, gain: 0.045 });
    }

    /** Sentence complete: quick soft ascending arpeggio (C–E–G–C) */
    sentenceComplete() {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this._tone(f, { start: i * 0.09, dur: 0.22, gain: 0.11 }));
    }

    /** Game complete: slightly longer celebratory run */
    gameComplete() {
        const notes = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((f, i) => this._tone(f, { start: i * 0.11, dur: 0.3, gain: 0.11 }));
    }
}

export const gameSounds = new SoundManager();
