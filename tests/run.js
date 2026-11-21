// Run all tests: gjs -m tests/run.js [--update]
//   --update  rewrite tests/snapshots/library.json, felder-lessons.json and field-zones.json from current behavior

import System from 'system';
import { listDir, readText } from './stubs.js'; // first: installs browser stubs
import { test, summary, settleAsyncTests } from './assert.js';
import { runGridTests } from './grid.test.js';
import { runGameRuleTests } from './gameRules.test.js';
import { runLibrarySnapshot } from './snapshot.test.js';
import { runIdTests } from './ids.test.js';
import { runSentencePickerTests } from './sentencePicker.test.js';
import { runProgressStoreTests } from './progressStore.test.js';
import { runSoundTests } from './sound.test.js';
import { runStoryTests } from './story.test.js';
import { runGlossaryTests } from './glossary.test.js';
import { runCheckStoryTests } from './checkStory.test.js';
import { runHomeScreenTests } from './homeScreen.test.js';
import { runStoryReaderTests } from './storyReader.test.js';
import { runPlayScreenTests } from './playScreen.test.js';
import { runChapterRecapTests } from './chapterRecap.test.js';
import { runSettingsTests } from './settings.test.js';
import { runLadderTests } from './ladder.test.js';
import { runFelderLessonTests } from './felderLesson.test.js';
import { runFieldZonesTests } from './fieldZones.test.js';
import { runOrderExerciseTests } from './orderExercise.test.js';
import { runArticleBlankTests } from './articleBlank.test.js';
import { runTextMatchTests } from './textMatch.test.js';
import { runSpeechInputTests } from './speechInput.test.js';
import { runWriteScreenTests } from './writeScreen.test.js';
import { runSpeakScreenTests } from './speakScreen.test.js';
import { runReviewRunnerTests } from './reviewRunner.test.js';
import { runBoardScheduleTests } from './boardSchedule.test.js';
import { runBoardsTests } from './boards.test.js';
import { runHotspotBoardTests } from './hotspotBoard.test.js';
import { runSceneBoardTests } from './sceneBoard.test.js';
import { runTimelineBoardTests } from './timelineBoard.test.js';
import { runKlinikTests } from './klinik.test.js';

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
runCheckStoryTests();
runHomeScreenTests();
runStoryReaderTests();
runPlayScreenTests();
runChapterRecapTests();
runSettingsTests();
runLadderTests();
runFelderLessonTests({ update });
runFieldZonesTests({ update });
runOrderExerciseTests();
runArticleBlankTests();
runTextMatchTests();
runSpeechInputTests();
runWriteScreenTests();
runSpeakScreenTests();
runReviewRunnerTests();
runBoardScheduleTests();
runBoardsTests();
runHotspotBoardTests();
runSceneBoardTests();
runTimelineBoardTests();
runKlinikTests();
runLibrarySnapshot({ update });

await settleAsyncTests();
System.exit(summary() > 0 ? 1 : 0);
