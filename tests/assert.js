// Tiny dependency-free test helper.

const results = [];

export function test(name, fn) {
    try {
        fn();
        results.push({ name, ok: true });
    } catch (e) {
        results.push({ name, ok: false, error: e });
    }
}

const pendingTests = [];

/** Async test: its result is recorded once `fn` settles; run.js awaits them (settleAsyncTests) before summary(). */
export function testAsync(name, fn) {
    pendingTests.push(Promise.resolve().then(fn).then(
        () => results.push({ name, ok: true }),
        e => results.push({ name, ok: false, error: e })));
}

/** Wait for every testAsync() registered so far. */
export function settleAsyncTests() {
    return Promise.all(pendingTests);
}

const show = v => JSON.stringify(v);

export function assertEqual(actual, expected, message = '') {
    if (show(actual) !== show(expected)) {
        throw new Error(`${message ? message + ': ' : ''}expected ${show(expected)}, got ${show(actual)}`);
    }
}

export function assert(condition, message = 'assertion failed') {
    if (!condition) throw new Error(message);
}

/** Print results; returns the number of failures. */
export function summary() {
    const failed = results.filter(r => !r.ok);
    for (const r of failed) print(`FAIL ${r.name}\n     ${r.error.message}`);
    print(`\n${results.length - failed.length}/${results.length} tests passed`);
    return failed.length;
}
