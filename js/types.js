// Core data shapes (JSDoc typedefs only — no code, not loaded by index.html).
// Referenced from function JSDoc as e.g. `@param {Word} word`. Enum values match
// data/library/*.json (checked 2026-10-25: 5041 words); keep in sync when adding values.

/**
 * @typedef {'subject'|'verb'|'modal'|'object'|'object-akk'|'object-dat'|'adjective'|
 *           'preposition'|'conjunction'|'coord-conjunction'|'other'} WordType
 *   Noun-typed (form phrase boxes, get a grid cell): subject and every type containing
 *   'object'. Connectors (sit on the arrows between boxes): verb, modal, preposition,
 *   conjunction, coord-conjunction, other. Adjectives join the surrounding box.
 */

/** @typedef {'m'|'f'|'n'|'none'} Gender */
/** @typedef {'nom'|'akk'|'dat'|'gen'} Case */
/** @typedef {'sg'|'pl'} GrammaticalNumber */

/**
 * @typedef {'ich'|'du'|'er'|'sie'|'es'|'wir'|'ihr'|'sie_pl'|'none'} Pronoun
 *   The subject's person (on verbs: the person they agree with). 'none' is a string,
 *   not null. 'sie_pl' = plural sie/Sie.
 */

/**
 * One word of a sentence. Library words carry every field; words created in the
 * editor (sentenceManager.createNewWord) start as type 'other'.
 * @typedef {Object} Word
 * @property {number} id            from nextId(); unique within the app, not stable across loads
 * @property {WordType} type
 * @property {string} text          as written, incl. trailing punctuation ("Äpfel.")
 * @property {Gender} gender
 * @property {Case} case            also set ('nom') on words where case is meaningless (verbs)
 * @property {GrammaticalNumber} number
 * @property {{pronoun: Pronoun}} conjugation
 * @property {'main'|'subordinate'|null} [clause_type]
 * @property {?number} [clause_id]
 * @property {number} x             editor canvas position (px)
 * @property {number} y
 * @property {'right'|'down'} flowDirection  'down' for subordinate-clause words
 */

/**
 * A sentence as stored by SentenceManager (localStorage key `deutschSentences`).
 * @typedef {Object} Sentence
 * @property {number} id
 * @property {string} text
 * @property {Word[]} words
 * @property {string} createdAt     ISO timestamp
 * @property {'library'} [source]   absent for user-created sentences
 * @property {string} [level]       library sentences only, e.g. 'A1'
 * @property {string} [category]    library sentences only, e.g. 'Hauptsatz'
 */

/**
 * A pre-parsed library file, data/library/<level>_<slug>.json.
 * Bump `version` on every edit — SentenceManager.bulkLoadLibraryCategory only
 * replaces stored words when it changes.
 * @typedef {Object} LibraryFile
 * @property {string} level
 * @property {string} category
 * @property {string} version       e.g. '2026-10-25b'
 * @property {{text: string, words?: Word[]}[]} sentences  no `words` = not yet analyzed (skipped)
 */

/**
 * A story chapter/drill file in data/levels/ (built by scripts/build_stories.py; more fields: see CURRICULUM.md).
 * @typedef {Object} LevelFile
 * @property {string} level
 * @property {string} category
 * @property {string[]} sentences
 * @property {Object<string, string>} [translations]  play text -> English; only sentences that have one
 */

/**
 * A grid cell, from GridViewModel.positions / getWordPosition (1-indexed).
 * @typedef {{row: number, col: number, label: string}} GridCell
 */

/**
 * One phrase box from parseSentenceFlow: consecutive non-connector words with the
 * same case and gender.
 * @typedef {Object} PhraseBox
 * @property {Word[]} words
 * @property {string} key           `${case}/${gender}` clustering key
 * @property {Case} case
 * @property {Word} mainWord        last noun-typed word (else last word); decides the grid cell
 */

/**
 * Result of GridViewModel.parseSentenceFlow(words).
 * @typedef {Object} ParsedSentence
 * @property {PhraseBox[]} boxes
 * @property {Word[][]} connections connections[i] = connector words after boxes[i]; when
 *   connections.length === boxes.length the last entry follows the last box
 * @property {Word[]} leadingWords   connectors before the first box
 * @property {Word[]} trailingWords  always empty (kept for API compatibility)
 */

/**
 * Reason object from validatePlacement (gameRules.js).
 * @typedef {Object} PlacementResult
 * @property {boolean} ok           cellOk && caseOk
 * @property {boolean} cellOk
 * @property {boolean} caseOk       true when case is not checked
 * @property {?Case} expectedCase   null when case is not checked (verbs, modals, words without case)
 * @property {?GridCell} expectedCell null = word has no cell
 */

/**
 * Outcome of one placement attempt, from evaluatePlacement (gameRules.js).
 * @typedef {Object} PlacementOutcome
 * @property {PlacementResult} result
 * @property {number} points
 * @property {?string} timeColor    time-challenge feedback color on a timed correct placement
 * @property {number} attempts      new wrong-attempt count (0 after success)
 * @property {boolean} autoPlace    true once MAX_WRONG_ATTEMPTS is reached
 */

/**
 * Wrong placements, from progressStore.addMistake (one PlacementResult each).
 * @typedef {Object} SentenceMistakes
 * @property {Object<Case, number>} case  wrong case, counted by the expected case
 * @property {number} cell          wrong grid cell
 */

/**
 * Play history of one sentence (progressStore.js).
 * @typedef {Object} SentenceProgress
 * @property {number} plays
 * @property {number} perfect       plays with no mistakes
 * @property {number} perfectStreak consecutive perfect plays up to the last one
 * @property {number} lastPlayed    ms timestamp
 * @property {number} lastMistakes  mistake count of the last play
 * @property {SentenceMistakes} mistakes  summed over all plays
 * @property {number} rung          review ladder: 0 = not on it, 2-5 (ladder.js)
 * @property {number} due           ms timestamp (local midnight) of the next review
 * @property {number} topPasses     passes in a row at the top rung
 * @property {number} lastReview    ms timestamp of the last review, 0 = never
 */

/**
 * A board file (data/boards/<id>.json, registered in boards.js).
 * @typedef {Object} BoardFile
 * @property {string} id
 * @property {string} title
 * @property {number} version  bump when the file changes (fetched with ?v=)
 * @property {string} kind     picture kind, registered via registerKind in boards.js (KINDS)
 * @property {{id: string, title: string, image: ?string, modes?: string[], mirror?: boolean, wide?: boolean,
 *   unlock: ?{level: string, category: string, label: string}, items: Object[]}[]} sets
 *   `modes`: the mode ids the set offers (default: all of the board's); `mirror`: the picture is
 *   left-right symmetric, so tap modes also accept the mirrored spot of `pair` items; `wide`: a hotspot
 *   picture in landscape 4:3 (viewBox 0 0 400 300) instead of portrait 3:4
 */

/**
 * One place of a scene board set (data/boards/wechselpraepositionen.json; logic in sceneBoard.js).
 * @typedef {Object} SceneLandmark
 * @property {string} de        noun, "der Tisch, Tische" (article first; "(pl.)" for plural-only)
 * @property {number[]} [front] [x, y, w, h] in percent of the picture: the landmark's front part; a "hinter"
 *   item redraws the picture clipped to this rect over the hen, so the landmark covers it
 */

/**
 * One position of a scene board set: where the mover goes (Wohin? Akkusativ) or rests (Wo? Dativ).
 * @typedef {Object} SceneItem
 * @property {string} id         unique within the set, "<prep>-<landmark>"
 * @property {string} prep       auf, in, an, unter, über, vor, hinter, neben, zwischen
 * @property {string} landmark   key of set.landmarks
 * @property {?string} landmark2 second landmark ("zwischen"), both articles change together; else null
 * @property {number[]} spot     [x, y] in percent: the hen's feet
 * @property {{wohin: string, wo: ?string}} verbs  `wo: null` = movement only (never asked as Wo?)
 */

/**
 * A scene board set: `BoardFile.sets[]` entry of kind `scene`.
 * @typedef {Object} SceneSet
 * @property {{de: string, image: string, home: number[]}} mover  the moving figure (separate SVG; `home` = start spot in percent)
 * @property {Object<string, SceneLandmark>} landmarks
 * @property {SceneItem[]} items
 */

/**
 * One verb of a timeline board set (data/boards/zeit.json; logic in timelineBoard.js).
 * @typedef {Object} TimelineVerb
 * @property {string} id         unique, equals `inf`
 * @property {string} inf        infinitive
 * @property {string} en         English meaning
 * @property {'haben'|'sein'} aux  Perfekt auxiliary
 * @property {string} partizip   participle
 * @property {[string, string]} wrong  two wrong participles (Klammer)
 * @property {'ich'|'du'|'er'|'wir'|'ihr'} person  person of `subject` (names are `er`)
 * @property {string} subject    the sentence subject as written
 * @property {string} finite     present-tense finite form
 * @property {string} [particle] separable particle (goes to the end in the Präsens)
 * @property {string} rest       the rest of the sentence (may be empty)
 */

/**
 * A timeline board set: `BoardFile.sets[]` entry of kind `timeline`.
 * @typedef {Object} TimelineSet
 * @property {TimelineVerb[]} items
 */

/**
 * Schedule entry of one board item (boardSchedule.js).
 * @typedef {Object} BoardEntry
 * @property {number} box       0-4 (BOX_DAYS)
 * @property {number} due       ms timestamp (local midnight) of the next review
 * @property {number} seen      answers recorded
 * @property {number} correct   right answers
 * @property {number} lastSeen  ms timestamp of the last answer
 */

/**
 * localStorage `gameProgress`; also the `progress` field of a sentence export.
 * @typedef {Object} GameProgress
 * @property {number} version       format version (3)
 * @property {Object<string, SentenceProgress>} sentences  keyed by sentenceKey(): level/category/text
 * @property {Object<string, BoardEntry>} boards  board item progress (boardSchedule.js), keyed by the board's item key
 * @property {{bestScore: number, bestStreak: number, sentencesPlayed: number}} totals
 */

/**
 * One reviewed sentence of a "Heute üben" session (reviewRunner.js → reviewRecapModel).
 * @typedef {Object} ReviewResult
 * @property {string} key           sentenceKey()
 * @property {string} text
 * @property {number} from          the rung shown
 * @property {number} to            the rung after the review
 * @property {boolean} ok           no mistake
 */

/**
 * One spot of a hotspot board set (data/boards/koerper.json; logic in hotspotBoard.js).
 * @typedef {Object} HotspotItem
 * @property {string} id      lowercase ASCII, unique within the set (^[a-z0-9-]+$)
 * @property {string} de      headword: "das Knie, Knie" or "die Haare (pl.)"
 * @property {string} en      English meaning
 * @property {[number, number]} spot  x, y in percent of the picture
 * @property {boolean} [pair] a person has more than one: the pain sentence may use the plural; in a `mirror` set it also has a spot on the other side
 * @property {string[]} [accepts] ids of items that also count as a right tap when this item is asked (bein: its parts)
 * @property {number[]} [area] [x, y, w, h] percent rect of the drawn place (a ward room): a tap inside it answers this item
 *   whatever the distance to the spot (the smallest area wins when areas nest); outside every area the nearest spot within 9 % answers
 */

/**
 * A Klinik case (data/medical/faelle/<id>.json, listed in index.json with the same id/title/level/version;
 * logic in caseFlow.js, interview in caseScreen.js). Question ids are those of data/medical/anamnese.json.
 * Every German string has its English (germanStrings() lists them; a test checks each).
 * @typedef {Object} Case
 * @property {number} version   bump on edit, together with its index.json entry
 * @property {string} id
 * @property {string} title
 * @property {string} level     'B1' | 'B2'
 * @property {{name: string, age: number, job: string, gender: 'f'|'m', en: string}} patient  `gender`: 'f' | 'm' (wording of the hints); `en` = the card line in English
 * @property {CaseStep[]} interview  in interview order; a section without a step is "nicht erhoben"
 * @property {{section: 'diagnosen'|'anamnese'|'befund'|'therapie'|'empfehlung', de: string, en: string}[]} brief  the Arztbrief sentences
 * @property {{section: string, model: string, en: string}[]} dokumentation  model text per Anamnese section id
 * @property {{skeleton: string, skeletonEn: string, model: string, modelEn: string}} vorstellung  Arzt-Arzt presentation: gap skeleton (…) and model
 */

/**
 * One interview step of a case.
 * @typedef {Object} CaseStep
 * @property {string} section   Anamnese section id
 * @property {string} question  the right question id (of this section, directly or via `also`)
 * @property {[string, string]} wrong  question ids from other sections or unfitting at this point
 * @property {{de: string, en: string}} answer  the patient's answer (B1)
 * @property {{de: string, en: string}} fact    the note that belongs in the form
 * @property {[{de: string, en: string}, {de: string, en: string}]} distractors  notes that do not follow from the answer
 */

/**
 * A Fachsprachenprüfung practice run in progress: localStorage `fspDraft/<caseId>` (caseFlow.js
 * examState/loadDraft/saveDraft; deleted at the end). Ratings are RATINGS indexes (0 Passt, 1 Teilweise, 2 Noch nicht).
 * @typedef {Object} ExamDraft
 * @property {number} part       0–2 = EXAM_PARTS index, 3 = the summary
 * @property {number} startedAt  when the run began (ms)
 * @property {number} elapsedMs  time spent in the current part (counts only while the part is open)
 * @property {Object<string, string>} texts  part 2: her text per Anamnese section id
 * @property {?{questions: number, facts: number, total: number}} [score]  part 1 first-try counts
 * @property {(?number)[]} [ratings]  part 2: one rating per section of examSections()
 * @property {boolean} [compared]     part 2: `Vergleichen` was tapped (texts are final)
 * @property {boolean} [presented]    part 3: `Ich bin fertig` was tapped
 * @property {?number} [talkRating]   part 3 rating
 */
