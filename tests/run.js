// Run all tests: gjs -m tests/run.js [--update]
//   --update  rewrite tests/snapshots/library.json from current behavior

import System from 'system';
import { listDir } from './stubs.js'; // first: installs browser stubs
import { test, summary } from './assert.js';
import { runGridTests } from './grid.test.js';
import { runGameRuleTests } from './gameRules.test.js';
import { runLibrarySnapshot } from './snapshot.test.js';
import { runIdTests } from './ids.test.js';
import { runSentencePickerTests } from './sentencePicker.test.js';

const update = System.programArgs.includes('--update');

// Import every app module: catches syntax errors and missing/misspelled imports or exports
for (const name of listDir('js').filter(n => n.endsWith('.js'))) {
    let error = null;
    try { await import(`../js/${name}`); } catch (e) { error = e; }
    test(`module loads: js/${name}`, () => { if (error) throw error; });
}

runGridTests();
runGameRuleTests();
runIdTests();
runSentencePickerTests();
runLibrarySnapshot({ update });

System.exit(summary() > 0 ? 1 : 0);
