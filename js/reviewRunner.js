/**
 * The daily review session of the production ladder ("Heute üben", see
 * docs/superpowers/specs/2026-11-15-production-ladder-design.md): plays the due sentences in
 * order, each on its rung — rung 2 on the Ordnen screen (orderScreen.js), rung 3 in the placement
 * game with its articles blanked (GameMode.articleBlank / GameMode.ladder), rung 4 on the Schreiben
 * screen (writeScreen.js), rung 5 on the Sprechen screen (speakScreen.js) — records each one with
 * progressStore.recordReview and ends on the review recap. The pure helpers at the top build the
 * queue; app.js (startLadderReview) feeds it and owns the screens.
 */

import { exerciseRung, rungEligibility } from './ladder.js';
import { orderModel } from './orderExercise.js';
import { renderOrderScreen } from './orderScreen.js';
import { renderWriteScreen } from './writeScreen.js';
import { renderSpeakScreen } from './speakScreen.js';

/**
 * @typedef {Object} ReviewItem
 * @property {string} key            sentenceKey()
 * @property {Sentence} sentence
 * @property {2|3|4|5} rung          the rung shown (exerciseRung)
 * @property {{2?: boolean, 3?: boolean, 4?: boolean, 5?: boolean}} eligible
 */

/** `level/category` of a progress key `level/category/text` (category keys have no "/"). */
export function keyCategory(key) {
    const first = key.indexOf('/');
    return key.slice(0, key.indexOf('/', first + 1));
}

/**
 * The session queue for due keys, in their order. Each key ends up in one of three lists:
 * - `retired` (the caller takes it off the ladder): a user-made (`custom/…`) key, a sentence
 *   missing from its loaded category (chapter changed), or one with no rung it can be tested on;
 * - `skipped`: its sentence is not there because its category did not load (offline, a failed
 *   fetch) — not shown, not retired, it stays due;
 * - `queue`: everything else.
 * @param {string[]} keys
 * @param {function(string): ?Sentence} findSentence
 * @param {function(string): number} getRung  the entry's stored rung
 * @param {function(string): boolean} [isCategoryLoaded]  the key's library category is loaded
 * @param {{voice: boolean, write: boolean, speak: boolean}} [env]  what this device supports (rungs 4 and 5);
 *   a missing env means rungs 4 and 5 are not offered
 * @returns {{queue: ReviewItem[], retired: string[], skipped: string[]}}
 */
export function buildQueue(keys, findSentence, getRung, isCategoryLoaded = () => true, env) {
    const queue = [];
    const retired = [];
    const skipped = [];
    for (const key of keys) {
        const sentence = key.startsWith('custom/') ? null : findSentence(key);
        if (!sentence && !key.startsWith('custom/') && !isCategoryLoaded(key)) {
            skipped.push(key);
            continue;
        }
        const eligible = sentence ? rungEligibility(sentence.words || [], env) : null;
        const rung = eligible ? exerciseRung(getRung(key), eligible) : null;
        if (rung === null) retired.push(key);
        else queue.push({ key, sentence, rung, eligible });
    }
    return { queue, retired, skipped };
}

/**
 * Runs one review session. `app` provides showScreen(name), showReviewRecap(results),
 * loadReviewSentence(sentence) (make it the game's current sentence) and redrawAll().
 * Every way out goes through close() or the end of the queue, which clear the game's
 * articleBlank and ladder.
 */
export class ReviewRunner {
    /**
     * @param {{app: Object, gameMode: GameMode, progressStore: ProgressStore,
     *   renderOrder?: typeof renderOrderScreen, orderRoot?: function(): ?HTMLElement,
     *   renderWrite?: typeof renderWriteScreen, writeRoot?: function(): ?HTMLElement,
     *   renderSpeak?: typeof renderSpeakScreen, speakRoot?: function(): ?HTMLElement,
     *   translationFor?: function(Sentence): ?string}} deps
     *   render* / *Root: the Ordnen / Schreiben / Sprechen screens (replaced in tests);
     *   translationFor: the English line shown on rungs 4 and 5 (null: none)
     */
    constructor({ app, gameMode, progressStore, renderOrder = renderOrderScreen,
        orderRoot = () => document.getElementById('screen-order'),
        renderWrite = renderWriteScreen, writeRoot = () => document.getElementById('screen-write'),
        renderSpeak = renderSpeakScreen, speakRoot = () => document.getElementById('screen-speak'),
        translationFor = () => null }) {
        this.app = app;
        this.gameMode = gameMode;
        this.progressStore = progressStore;
        this.renderOrder = renderOrder;
        this.orderRoot = orderRoot;
        this.renderWrite = renderWrite;
        this.writeRoot = writeRoot;
        this.renderSpeak = renderSpeak;
        this.speakRoot = speakRoot;
        this.translationFor = translationFor;
        /** @type {?function(): void} teardown of the write/speak screen on show */
        this.teardown = null;
        this.active = false;
        this.queue = [];
        this.index = 0;
        /** @type {ReviewResult[]} */
        this.results = [];
    }

    /** @param {ReviewItem[]} queue */
    start(queue) {
        this.queue = queue;
        this.index = 0;
        this.results = [];
        this.active = queue.length > 0;
        if (this.active) this.show();
        else this.app.showScreen('home');
    }

    /** End the session early (✕): the sentences not finished stay due. */
    close() {
        if (!this.active) return;
        this.active = false;
        this.stopScreen();
        this.app.showScreen('home');
        this.clearGame();
    }

    /** End the session without routing (the app already left for another screen, e.g. the nav). */
    abandon() {
        if (!this.active) return;
        this.active = false;
        this.stopScreen();
        this.clearGame();
    }

    // --- internals ---

    /** Stop what the write/speak screen on show still runs (microphone, timers, speech). */
    stopScreen() {
        const t = this.teardown;
        this.teardown = null;
        if (t) t();
    }

    show() {
        this.stopScreen();
        const item = this.queue[this.index];
        if (item.rung === 2) this.showOrder(item);
        else if (item.rung === 4) this.showWrite(item);
        else if (item.rung === 5) this.showSpeak(item);
        else this.showGame(item); // rung 3
    }

    /** True while `item` is the one on screen (callbacks of an earlier screen are ignored). */
    isCurrent(item) {
        return this.active && this.queue[this.index] === item;
    }

    showOrder(item) {
        // Route first: leaving the play screen stops a running game (app.showScreen)
        this.app.showScreen('order');
        this.clearGame();
        this.renderOrder(this.orderRoot(), {
            model: orderModel(item.sentence.words), total: this.queue.length, index: this.index,
        }, {
            onDone: mistakes => {
                if (!this.isCurrent(item)) return;
                this.record(item, mistakes === 0);
                this.next(item);
            },
            onClose: () => { if (this.isCurrent(item)) this.close(); },
        });
    }

    /** Rungs 4 (Schreiben) and 5 (Sprechen): a text screen like Ordnen; onDone(ok) records the review. */
    showText(item, screen, root, render) {
        this.app.showScreen(screen);
        this.clearGame();
        this.teardown = render(root, {
            text: item.sentence.text, translation: this.translationFor(item.sentence),
            total: this.queue.length, index: this.index,
        }, {
            onDone: ok => {
                if (!this.isCurrent(item)) return;
                this.record(item, !!ok);
                this.next(item);
            },
            onClose: () => { if (this.isCurrent(item)) this.close(); },
        });
    }

    showWrite(item) { this.showText(item, 'write', this.writeRoot(), this.renderWrite); }

    showSpeak(item) { this.showText(item, 'speak', this.speakRoot(), this.renderSpeak); }

    showGame(item) {
        const gm = this.gameMode;
        this.app.showScreen('play');
        this.app.loadReviewSentence(item.sentence);
        // Set before start()/startNewSentence(): the first word's Hörübung prompt checks articleBlank
        gm.articleBlank = true;
        gm.ladder = {
            total: this.queue.length,
            index: this.index,
            record: (sentence, mistakes) => { if (this.isCurrent(item)) this.record(item, mistakes === 0); },
            next: () => { if (this.isCurrent(item)) this.next(item); },
        };
        if (gm.isActive) gm.startNewSentence();
        else gm.start();
        this.app.redrawAll();
    }

    record(item, ok) {
        if (this.results.some(r => r.key === item.key)) return; // one result per sentence
        const entry = this.progressStore.recordReview(item.key, ok, item.eligible);
        this.results.push({ key: item.key, text: item.sentence.text, from: item.rung,
            to: entry ? entry.rung : item.rung, ok });
    }

    next(item) {
        if (!this.isCurrent(item)) return;
        this.index++;
        if (this.index < this.queue.length) {
            this.show();
            return;
        }
        this.active = false;
        this.stopScreen();
        this.app.showReviewRecap(this.results);
        this.clearGame();
    }

    /** Back to a normal game: articles visible, progress recorded the normal way. */
    clearGame() {
        const gm = this.gameMode;
        gm.articleBlank = false;
        gm.ladder = null;
        if (gm.isActive) gm.stop();
    }
}
