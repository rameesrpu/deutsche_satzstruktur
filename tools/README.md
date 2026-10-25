# tools/

Old dev/debug helpers, not part of the app. Serve the repo root (`python3 -m http.server 8000`) for the HTML pages.

- `check_localstorage.html` — inspect/clear the app's localStorage (same origin as the app).
- `test_grouping.html` — manual check of `GridViewModel.parseSentenceFlow()` phrase grouping.
- `test_grammar.py` — calls the backend `/check-grammar` endpoint (needs `backend/` running).
- `spacy_test.py` — spaCy parse dump for one sentence: `python3 tools/spacy_test.py "Satz."`
