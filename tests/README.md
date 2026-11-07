# Tests

- Run everything: `gjs -m tests/run.js` (exit 0 = pass). No node, no dependencies.
- Includes importing every `js/*.js` module (syntax + missing imports/exports), unit tests, and a golden snapshot of how every library sentence is parsed and placed (`tests/snapshots/library.json`).
- After an *intended* behavior or library-data change: `gjs -m tests/run.js --update`, then review `git diff tests/snapshots/`.
- `tests/felderLesson.test.js` writes `tests/snapshots/felder-lessons.json`: the field-model lesson (or `-`) of every A1 story chapter sentence and the share per chapter — review it by hand when the rules or chapters change.
- `tests/glossary.test.js` also runs `python3` to check that `scripts/build_stories.py` matches glossary words like `js/glossary.js` and reports unused forms.
- Tests import the app's ES modules directly (`../js/x.js`). `tests/stubs.js` (imported first by run.js) installs `window`/`document`/`localStorage` stubs on `globalThis` and filters gjs console output; set `globalThis.localStorage = makeLocalStorage()` for a fresh store.
