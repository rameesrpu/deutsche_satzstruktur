// Run all tests: gjs -m tests/run.js [--update]
//   --update  rewrite tests/snapshots/library.json from current behavior

import System from 'system';
import { listDir, readText } from './stubs.js';
import { test, summary } from './assert.js';
import { runGridTests } from './grid.test.js';
import { runGameRuleTests } from './gameRules.test.js';
import { runLibrarySnapshot } from './snapshot.test.js';

const update = System.programArgs.includes('--update');

// Syntax-check every app script (same as loading it in the browser, minus execution)
for (const name of listDir('js').filter(n => n.endsWith('.js'))) {
    test(`syntax: js/${name}`, () => { new Function(readText(`js/${name}`)); });
}

runGridTests();
runGameRuleTests();
runLibrarySnapshot({ update });

System.exit(summary() > 0 ? 1 : 0);
