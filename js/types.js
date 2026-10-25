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
 */

/**
 * localStorage `gameProgress`; also the `progress` field of a sentence export.
 * @typedef {Object} GameProgress
 * @property {number} version       format version (1)
 * @property {Object<string, SentenceProgress>} sentences  keyed by sentenceKey(): level/category/text
 * @property {{bestScore: number, bestStreak: number, sentencesPlayed: number}} totals
 */
