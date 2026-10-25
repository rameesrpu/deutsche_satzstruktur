# Tests

- Run everything: `gjs -m tests/run.js` (exit 0 = pass). No node, no dependencies.
- Includes a syntax check of every `js/*.js`, unit tests, and a golden snapshot of how every library sentence is parsed and placed (`tests/snapshots/library.json`).
- After an *intended* behavior or library-data change: `gjs -m tests/run.js --update`, then review `git diff tests/snapshots/`.
- App scripts are plain globals; `tests/stubs.js` evaluates them with stubbed `window`/`document`/`localStorage`/`console`. Methods that need a DOM-heavy constructor are called via `Class.prototype.method.call(minimalThis, ...)`.
