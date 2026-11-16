import GLib from 'gi://GLib';
import { REPO_ROOT } from './stubs.js';
import { test } from './assert.js';

/** Runs the chapter checker's Python unit tests (scripts/test_check_story.py); fails on a non-zero exit. */
export function runCheckStoryTests() {
    test('check_story.py unit tests pass (python3 -m unittest scripts/test_check_story.py)', () => {
        const [, , err, status] = GLib.spawn_sync(REPO_ROOT,
            ['python3', '-m', 'unittest', 'scripts/test_check_story.py'], null,
            GLib.SpawnFlags.SEARCH_PATH, null);
        if (status !== 0) throw new Error(`unittest failed:\n${new TextDecoder('utf-8').decode(err)}`);
    });
}
