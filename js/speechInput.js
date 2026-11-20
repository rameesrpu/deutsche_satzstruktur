// Speech recognition for the "Sprechen" rung of the review ladder (browser Web Speech API).
// Pure availability check plus listen(): one recognition, settled exactly once.

/**
 * @param {object} [win]
 * @returns {boolean} true when the browser offers (webkit)SpeechRecognition
 */
export function speechAvailable(win = globalThis) {
    return typeof win.SpeechRecognition === 'function' || typeof win.webkitSpeechRecognition === 'function';
}

/**
 * Listen for one German sentence. The outcome settles exactly once: with the alternatives of the
 * first final result, or `heard: []` and `error` = the recogniser's error code ('no-speech',
 * 'not-allowed', 'network', …), 'no-result' when it ends silently, 'aborted' after abort(), or
 * 'start-failed' when there is no recogniser or start() throws. Events after that are ignored.
 * `outcome` is the settled value (null until then), readable synchronously; `result` resolves with it.
 * @param {{lang?: string, maxAlternatives?: number, win?: object}} [opts]
 * @returns {{result: Promise<{heard: string[], error: ?string}>, abort(): void, readonly outcome: ?{heard: string[], error: ?string}}}
 */
export function listen({ lang = 'de-DE', maxAlternatives = 5, win = globalThis } = {}) {
    let outcome = null;
    let resolve;
    const result = new Promise(r => { resolve = r; });
    let rec = null;
    const settle = (heard, error) => {
        if (outcome) return;
        outcome = { heard, error };
        resolve(outcome);
    };
    const handle = {
        result,
        get outcome() { return outcome; },
        abort() {
            if (outcome) return;
            settle([], 'aborted');
            try { rec?.abort(); } catch { /* already stopped */ }
        },
    };

    try {
        const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
        rec = new Recognition();
        rec.lang = lang;
        rec.interimResults = false;
        rec.maxAlternatives = maxAlternatives;
        rec.continuous = false;
        rec.onresult = e => {
            const list = e.results || [];
            for (let i = e.resultIndex || 0; i < list.length; i++) {
                const res = list[i];
                if (res.isFinal === false) continue;
                const heard = [];
                for (let k = 0; k < res.length; k++) {
                    const t = String(res[k]?.transcript ?? '').trim();
                    if (t) heard.push(t);
                }
                if (heard.length) { settle(heard, null); return; }
            }
        };
        rec.onerror = e => settle([], (e && e.error) || 'unknown');
        rec.onend = () => settle([], 'no-result');
        rec.start();
    } catch {
        settle([], 'start-failed');
    }
    return handle;
}
