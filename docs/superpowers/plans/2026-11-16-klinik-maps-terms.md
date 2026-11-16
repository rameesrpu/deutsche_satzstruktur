# Klinik: Maps and Terms Implementation Plan (5a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Klinik" area with the path to the Approbation as a route she can tick off, a board of medical ↔ everyday term pairs, and the ward as two hotspot pictures.

**Architecture:** A new screen with tiles; a route view driven by a researched JSON file with sources; a new board kind `pairs` and two `hotspot` sets on the boards framework from plan 4a.

**Tech Stack:** Plain ES modules, SVG, JSON data, tests with `gjs -m tests/run.js`. Task 1 needs web access.

**Spec:** [docs/superpowers/specs/2026-11-16-medical-track-design.md](../specs/2026-11-16-medical-track-design.md)

**Depends on:** plan 4a (`2026-11-16-boards-body-map.md`) built. Before Task 2 read `js/boards.js`, `js/boardScreen.js`, `js/hotspotBoard.js` and `js/homeScreen.js` as built; where a name below differs from the code, the code wins and the report says so. **Re-read the spec first: it was written long before this plan's turn and says so.**

## Global Constraints

- All Global Constraints of plan 4a apply (pictures, colours, phone first, versions, import map, commits).
- No statement about licensing, exams or authorities ships without a source URL from an official body (Regierungspräsidium Stuttgart, Landesärztekammer Baden-Württemberg, Bundesärztekammer, a federal ministry, `anerkennung-in-deutschland.de`) and the date it was checked. Forums and course sellers are not sources.
- Every route screen shows `Stand: <date>` and the line `Ohne Gewähr. Maßgeblich sind die Angaben der Behörden.`
- Every term pair is checked against a medical dictionary (Pschyrembel or DocCheck Flexikon) for the term, its article and its everyday word. A pair that cannot be confirmed is dropped, not guessed.
- Cases, patients and hospitals are invented. No medical or legal advice.
- UI copy is German; explanations on route cards are German with an English line under them.
- Two tasks stop for the owner (Tasks 1 and 4).

## Review Focus

1. **A station whose source page has moved or changed**: the data keeps `checked` per station; the route view shows the oldest `checked` date as "Stand", so one stale station makes the whole route look as old as it is. Test in Task 2.
2. **Ticks stored for stations that no longer exist** after a data update: ignored, never counted. Test in Task 2.
3. **Pairs with the same everyday word or the same first letters** (*Hypertonie* / *Hypotonie*, *Arthrose* / *Arthritis*): the choice lists must include the near twin when there is one, because that is the confusion worth practising. Test in Task 3.
4. **Plural-only entries** (*die Kopfschmerzen (pl.)*): parse and display like the body map's plural-only nouns. Test in Task 3.
5. **Narrow screens**: the route is vertical on a phone (stations under each other), never a wide diagram that scrolls sideways. Checked in Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `data/medical/approbation.json` (new) | Route stations with sources and check dates |
| `docs/medical-sources.md` (new) | What was checked, where, when; open doubts |
| `js/klinik.js` (new) | Klinik screen: tiles, route view, pure route helpers |
| `js/pairsBoard.js` (new) | `pairs` board kind: pure helpers + three modes |
| `data/boards/fachbegriffe.json` (new) | Term pairs by organ system |
| `data/boards/station.json`, `data/boards/img/station.svg`, `team.svg` (new) | Ward rooms and roles |

---

### Task 1: Research the path (stops for the owner)

**Model:** opus, with web access

**Files:**
- Create: `data/medical/approbation.json`, `docs/medical-sources.md`

**Interfaces:**
- Produces: `{version: number, region: 'Baden-Württemberg', stations: Station[]}` with `Station` = `{id: string, title: string, what: string, en: string, terms: {de: string, en: string}[], documents: string[], duration: ?string, cost: ?string, authority: string, optional: boolean, source: string (URL), checked: string (YYYY-MM-DD)}`. `what` is two or three plain German sentences at B1 level; `en` is the same in English; `documents` and `terms` use the official German names.

- [ ] **Step 1: Read** the official pages for doctors with a degree from outside the EU who want to work in Baden-Württemberg: the application for the Approbation and the Berufserlaubnis, the assessment of the degree, the required general German level, the Fachsprachprüfung (who runs it in Baden-Württemberg, its parts, length, fee, how to register), the Kenntnisprüfung, and what follows the Approbation.
- [ ] **Step 2: Write** the stations in the order a person meets them. Mark stations that only some applicants need as `optional` (the spec's list is a starting guess, not the answer: correct it from the sources).
- [ ] **Step 3: Write** `docs/medical-sources.md`: per station the URL, the date, the sentences relied on (quoted in German, short), and anything the sources leave unclear or that differs between sources.
- [ ] **Step 4: Check the FSP format** stated in the spec (three parts, twenty minutes each) against the Landesärztekammer's own description and record the result in `docs/medical-sources.md`; plan 5b builds on it.
- [ ] **Step 5: Stop.** Give the owner the station list in plain words and the open doubts. Ask which path applies to her (spec, open question 1). Apply changes.
- [ ] **Step 6: Commit** — `git add data/medical docs/medical-sources.md && git commit -m "Add researched path to the Approbation (Baden-Württemberg)"`

---

### Task 2: Klinik screen and route

**Model:** sonnet

**Files:**
- Create: `js/klinik.js`, `tests/klinik.test.js`
- Modify: `js/homeScreen.js` (`renderPractice`: a `Klinik` card above `Bilder`), `js/app.js` (`showScreen('klinik')`, `renderKlinikScreen`), `index.html` (`<main class="screen" id="screen-klinik" aria-label="Klinik" hidden></main>`; import map), `css/styles.css`, `tests/run.js`

**Interfaces:**
- Consumes: the route file (Task 1).
- Produces:
  - localStorage key `klinikRoute` = JSON array of done station ids
  - Pure `routeState(stations, doneIds: string[]): {stations: {id, title, optional, done: boolean, next: boolean}[], doneCount: number, total: number, stand: string}` — unknown ids ignored; `next` is true for the first station that is not done and not optional; `total` and `doneCount` count non-optional stations; `stand` = the earliest `checked` date formatted `TT.MM.JJJJ`
  - Pure `toggleStation(doneIds: string[], id: string): string[]`
  - `KLINIK_TILES: {id: string, title: string, level: ?string, open: 'route'|'board'|'soon', boardId: ?string}[]` — `Der Weg zur Approbation` (route), `Fachsprache und Alltagssprache` (board `fachbegriffe`), `Die Station` (board `station`), and three tiles with `open: 'soon'`: `Anamnese` (`ab B1`), `Arztbrief` (`ab B2`), `Fachsprachprüfung` (`ab B2`)
  - `renderKlinik(root, state: {tiles, route: ReturnType<typeof routeState>}, actions: {openRoute(), openBoard(id), close()})` and `renderRoute(root, state: {stations: Station[], route}, actions: {toggle(id), back()})`
- Route view: a vertical line with a node per station (done = filled, next = ringed, optional = dashed outline with the tag `nur manchmal`). Tapping a station opens its card: `what`, the English line, `Wörter` (terms), `Unterlagen` (documents), `Dauer`, `Kosten`, `Zuständig` (authority), a link `Quelle`, and the button `Erledigt` / `Doch nicht erledigt`. Header: `` `${doneCount} von ${total} Schritten` ``. Footer: `` `Stand: ${stand}` `` and `Ohne Gewähr. Maßgeblich sind die Angaben der Behörden.`
- A `soon` tile is greyed and says `Kommt bald`.

- [ ] **Step 1: Write the failing tests**: `routeState` with one optional station and one done id (counts, `next`, an unknown stored id ignored, `stand` = the oldest date, formatted); `toggleStation` adds and removes; `KLINIK_TILES` has six tiles in the order above.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the module, the Üben card (title `Klinik`, text `Der Weg ins Krankenhaus`), the screens and the CSS.
- [ ] **Step 4: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 5: Check on screen** at 400×850: the Klinik tiles; the route with every station visible by scrolling down only; a station card; ticking a station changes the header count and survives a reload.
- [ ] **Step 6: Commit** — `git add -A js css tests index.html && git commit -m "Add Klinik screen and the path to the Approbation"`

---

### Task 3: Term pairs board

**Model:** sonnet

**Files:**
- Create: `js/pairsBoard.js`, `tests/pairsBoard.test.js`, `data/boards/fachbegriffe.json`
- Modify: `js/boards.js` (`BOARDS` entry), `js/app.js` (import so the kind registers), `css/styles.css`, `tests/run.js`, `index.html` (import map)

**Interfaces:**
- Consumes: `parseNoun` from `js/hotspotBoard.js`; `registerKind`; the `ctx` contract (plan 4a Task 3).
- Produces:
  - `BOARDS` entry: id `fachbegriffe`, title `Fachsprache und Alltagssprache`, kind `pairs`, file `data/boards/fachbegriffe.json`, modes `paare` / `Paare` (not scored), `patient` / `Für den Patienten`, `kollegin` / `Für die Kollegin`
  - Item = `{id: string, fach: string, alltag: string, en: string, twin: ?string}` — `fach` and `alltag` are headwords with article (`"die Appendizitis"`, `"die Kopfschmerzen (pl.)"`); `twin` is the id of a confusable item in the same file
  - One set per organ system, no unlock: `herz` `Herz und Kreislauf`, `atmung` `Atmung`, `verdauung` `Verdauung`, `niere` `Niere und Blase`, `bewegung` `Knochen und Gelenke`, `kopf` `Kopf und Nerven`, `haut` `Haut`, `allgemein` `Allgemeines`
  - Pure `choiceOptions(items, id: string, side: 'alltag'|'fach', rng = Math.random): string[]` — four item ids including `id`; includes the item's `twin` when it has one; the rest from the same set, then from other sets if the set is too small; shuffled
  - Pure `pairRound(items, rng = Math.random): {tiles: {key: string, itemId: string, side: 'fach'|'alltag', text: string}[]}` — six items (or all, if fewer), twelve shuffled tiles
  - Pure `isPair(a: tile, b: tile): boolean` — same `itemId`, different `side`
- Starting pairs (fach — alltag — English). Check each one (Global Constraints) and drop or correct what does not hold; add `twin` where marked:
  - `herz`: die Hypertonie — der Bluthochdruck — high blood pressure (twin Hypotonie) · die Hypotonie — der niedrige Blutdruck — low blood pressure (twin Hypertonie) · der Myokardinfarkt — der Herzinfarkt — heart attack · die Herzinsuffizienz — die Herzschwäche — heart failure · die Tachykardie — das Herzrasen — racing heart · der Apoplex — der Schlaganfall — stroke · die Thrombose — das Blutgerinnsel — blood clot · die Anämie — die Blutarmut — anaemia
  - `atmung`: die Pneumonie — die Lungenentzündung — pneumonia · die Dyspnoe — die Atemnot — shortness of breath · die Rhinitis — der Schnupfen — runny nose · die Tonsillitis — die Mandelentzündung — tonsillitis · die Sinusitis — die Nasennebenhöhlenentzündung — sinusitis
  - `verdauung`: die Appendizitis — die Blinddarmentzündung — appendicitis · die Gastritis — die Magenschleimhautentzündung — gastritis · die Diarrhö — der Durchfall — diarrhoea (twin Obstipation) · die Obstipation — die Verstopfung — constipation (twin Diarrhö) · die Emesis — das Erbrechen — vomiting (twin Nausea) · die Nausea — die Übelkeit — nausea (twin Emesis) · die Hepatitis — die Leberentzündung — hepatitis · der Ikterus — die Gelbsucht — jaundice · das Ulcus ventriculi — das Magengeschwür — stomach ulcer · die Dysphagie — die Schluckstörung — difficulty swallowing · die Koloskopie — die Darmspiegelung — colonoscopy (twin Gastroskopie) · die Gastroskopie — die Magenspiegelung — gastroscopy (twin Koloskopie)
  - `niere`: die Zystitis — die Blasenentzündung — bladder infection · die Nephrolithiasis — die Nierensteine (pl.) — kidney stones · die Hämaturie — das Blut im Urin — blood in the urine
  - `bewegung`: die Fraktur — der Knochenbruch — fracture · die Arthrose — der Gelenkverschleiß — osteoarthritis (twin Arthritis) · die Arthritis — die Gelenkentzündung — arthritis (twin Arthrose) · die Distorsion — die Verstauchung — sprain · die Osteoporose — der Knochenschwund — osteoporosis · die Lumbago — der Hexenschuss — lumbago
  - `kopf`: die Zephalgie — die Kopfschmerzen (pl.) — headache · die Synkope — die Ohnmacht — fainting · die Commotio cerebri — die Gehirnerschütterung — concussion · die Insomnie — die Schlafstörung — insomnia
  - `haut`: das Exanthem — der Hautausschlag — rash · der Pruritus — der Juckreiz — itching · das Ödem — die Wassereinlagerung — oedema · das Hämatom — der blaue Fleck — bruise · die Urtikaria — die Nesselsucht — hives
  - `allgemein`: der Diabetes mellitus — die Zuckerkrankheit — diabetes · die Adipositas — das starke Übergewicht — obesity · die Hyperthyreose — die Schilddrüsenüberfunktion — overactive thyroid (twin Hypothyreose) · die Hypothyreose — die Schilddrüsenunterfunktion — underactive thyroid (twin Hyperthyreose) · das Karzinom — der Krebs — cancer · die Analgetika (pl.) — die Schmerzmittel (pl.) — painkillers · die Injektion — die Spritze — injection · die Sonografie — der Ultraschall — ultrasound · die Anamnese — die Krankengeschichte — medical history
- Modes: `paare`: `pairRound` tiles in a grid, medical terms on one colour of card and everyday words on another (two neutral tokens, not gender colours); tap two tiles; a pair locks, a mismatch flips back; `Neue Runde` when all are matched. `patient`: the `fach` headword large, four `alltag` buttons from `choiceOptions(…, 'alltag')`. `kollegin`: the reverse. After a scored answer both words and the English meaning show, and the words are spoken.

- [ ] **Step 1: Write the failing tests**: `choiceOptions` returns four distinct ids with the asked one and its twin; with a three-item set it fills from other sets; `pairRound` gives twelve tiles for six items, each item once per side; `isPair` true only for the two sides of one item; data test: 8 sets, at least 45 items in total, ids unique across the file, every `fach` and `alltag` parses with `parseNoun`, every `twin` names an existing item and twins point at each other.
- [ ] **Step 2: Run** `gjs -m tests/run.js`. Expected: FAIL.
- [ ] **Step 3: Verify the pairs** against a medical dictionary and write the data file. List every dropped or changed pair with the reason in the task report.
- [ ] **Step 4: Implement** the pure functions and the renderer.
- [ ] **Step 5: Run** `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 6: Check on screen** at 400×850: twelve tiles fit without scrolling (long words like *Nasennebenhöhlenentzündung* wrap inside their tile); one right and one wrong answer in each scored mode.
- [ ] **Step 7: Commit** — `git add -A js css data tests index.html && git commit -m "Add medical and everyday term pairs board"`

---

### Task 4: The ward (stops for the owner)

**Model:** opus (pictures)

**Files:**
- Create: `data/boards/station.json`, `data/boards/img/station.svg`, `station.txt`, `team.svg`, `team.txt`
- Modify: `js/boards.js` (`BOARDS` entry), `tests/hotspotBoard.test.js`

**Interfaces:**
- Consumes: the `hotspot` kind as built.
- Produces:
  - `BOARDS` entry: id `station`, title `Die Station`, kind `hotspot`, file `data/boards/station.json`, modes `entdecken`, `zeigen`, `benennen` (no `schmerz` mode; if the kind's renderer assumes four modes, make it take its modes from the registry entry, with a test)
  - Set `raeume`, title `Die Räume`, image `img/station.svg` (a floor plan seen from above, `viewBox="0 0 400 300"`): das Stationszimmer, Stationszimmer (nurses' station) · das Arztzimmer, Arztzimmer (doctors' office) · das Patientenzimmer, Patientenzimmer (patient room) · das Untersuchungszimmer, Untersuchungszimmer (examination room) · der Flur, Flure (corridor) · der Aufzug, Aufzüge (lift) · das Treppenhaus, Treppenhäuser (stairwell) · der Aufenthaltsraum, Aufenthaltsräume (day room) · das Lager, Lager (store room) · die Teeküche, Teeküchen (staff kitchenette) · das Bad, Bäder (bathroom) · der Eingang, Eingänge (entrance)
  - Set `team`, title `Das Team`, image `img/team.svg` (boxes joined by lines, top to bottom, no people): die Chefärztin, Chefärztinnen (head of department) · der Oberarzt, Oberärzte (senior physician) · die Fachärztin, Fachärztinnen (specialist) · der Assistenzarzt, Assistenzärzte (junior doctor) · die Stationsleitung, Stationsleitungen (ward manager) · die Pflegefachkraft, Pflegefachkräfte (nurse) · der Auszubildende, Auszubildenden (trainee) · die Hospitantin, Hospitantinnen (observer, her first role)

- [ ] **Step 1: Check the vocabulary** (rooms and roles as a hospital in Baden-Württemberg names them today; *Pflegefachkraft* versus older terms) and correct the list.
- [ ] **Step 2: Draw** both pictures under plan 4a's picture constraints; place the points; write the data file.
- [ ] **Step 3: Extend the data test** in `tests/hotspotBoard.test.js` to run over every `hotspot` board file, and add the spacing check (no two points closer than 6 percent).
- [ ] **Step 4: Proof sheet** as in plan 4a Task 5; screenshot.
- [ ] **Step 5: Stop.** Show the owner the proof sheets and the vocabulary; ask the owner's wife to confirm the roles and room names. Apply changes.
- [ ] **Step 6: Run** `gjs -m tests/run.js`; commit — `git add -A js data tests && git commit -m "Add the ward: rooms and team"`

---

### Task 5: Docs and ship

**Model:** sonnet

**Files:**
- Modify: `CLAUDE.md` (file list: `klinik.js`, `pairsBoard.js`; Data: `data/medical/`, the sources document and the rule that route data needs sources and dates), `docs/roadmap.md` (progress tracker), `index.html` (versions)

- [ ] **Step 1: Update** the docs.
- [ ] **Step 2:** `scripts/bump_version.sh`; `gjs -m tests/run.js`. Expected: exit 0.
- [ ] **Step 3: Commit** — `git commit -am "Document the Klinik area, bump versions"`
