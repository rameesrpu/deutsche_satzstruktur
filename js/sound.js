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
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('gameSoundEnabled') !== 'false';
    }

    setEnabled(on) {
        this.enabled = on;
        localStorage.setItem('gameSoundEnabled', on ? 'true' : 'false');
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

    /** Correct placement: soft marimba pop, pitch climbs with the streak */
    correct(streak = 0) {
        const base = 523.25; // C5
        const majorScale = [0, 2, 4, 5, 7, 9, 11, 12]; // semitone steps
        const semis = majorScale[Math.min(Math.max(streak, 0), majorScale.length - 1)];
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

const gameSounds = new SoundManager();
