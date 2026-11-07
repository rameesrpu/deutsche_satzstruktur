// Run all tests: gjs -m tests/run.js [--update]
//   --update  rewrite tests/snapshots/library.json and felder-lessons.json from current behavior

import System from 'system';
import { listDir, readText } from './stubs.js'; // first: installs browser stubs
import { test, summary } from './assert.js';
import { runGridTests } from './grid.test.js';
import { runGameRuleTests } from './gameRules.test.js';
import { runLibrarySnapshot } from './snapshot.test.js';
import { runIdTests } from './ids.test.js';
import { runSentencePickerTests } from './sentencePicker.test.js';
import { runProgressStoreTests } from './progressStore.test.js';
import { runSoundTests } from './sound.test.js';
import { runStoryTests } from './story.test.js';
import { runGlossaryTests } from './glossary.test.js';
import { runHomeScreenTests } from './homeScreen.test.js';
import { runStoryReaderTests } from './storyReader.test.js';
import { runPlayScreenTests } from './playScreen.test.js';
import { runChapterRecapTests } from './chapterRecap.test.js';
import { runSettingsTests } from './settings.test.js';
import { runFelderLessonTests } from './felderLesson.test.js';

const update = System.programArgs.includes('--update');

// Import every app module: catches syntax errors and missing/misspelled imports or exports
for (const name of listDir('js').filter(n => n.endsWith('.js'))) {
    let error = null;
    try { await import(`../js/${name}`); } catch (e) { error = e; }
    test(`module loads: js/${name}`, () => { if (error) throw error; });
}

// Every loaded module needs a cache-busting entry in index.html's import map, or browsers
// keep an old copy after scripts/bump_version.sh (types.js is JSDoc only, never loaded)
const indexHtml = readText('index.html');
for (const name of listDir('js').filter(n => n.endsWith('.js') && n !== 'types.js')) {
    test(`import map lists js/${name}`, () => {
        if (!indexHtml.includes(`"./js/${name}": "./js/${name}?v=`)) throw new Error(`add "./js/${name}" to the import map`);
    });
}

runGridTests();
runGameRuleTests();
runIdTests();
runSentencePickerTests();
runProgressStoreTests();
runSoundTests();
runStoryTests();
runGlossaryTests();
runHomeScreenTests();
runStoryReaderTests();
runPlayScreenTests();
runChapterRecapTests();
runSettingsTests();
runFelderLessonTests({ update });
runLibrarySnapshot({ update });

System.exit(summary() > 0 ? 1 : 0);
