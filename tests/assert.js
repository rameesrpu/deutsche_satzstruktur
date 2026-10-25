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
