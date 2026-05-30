from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spacy
from typing import List, Dict
import sys
import subprocess
import requests

app = FastAPI(title="German NLP Analyzer", version="1.0.0")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load German spaCy model (will be downloaded on first run)
try:
    nlp = spacy.load("de_core_news_sm")
except OSError:
    print("Downloading German spaCy model...")
    import subprocess
    subprocess.run(["python", "-m", "spacy", "download", "de_core_news_sm"])
    nlp = spacy.load("de_core_news_sm")

# LanguageTool Public API Configuration
LANGUAGETOOL_API_URL = "https://api.languagetool.org/v2/check"

W_WORDS = frozenset({
    "wie", "was", "wo", "wer", "warum", "woher", "wohin", "wann",
    "welche", "welcher", "welches", "welchem", "welchen", "wessen", "wen", "wem"
})
PERSONAL_PRONOUNS = frozenset({"ich", "du", "er", "sie", "es", "wir", "ihr"})


def detect_v1_question(text: str) -> bool:
    """Return True for verb-initial yes/no questions like 'Sprichst du Deutsch?'"""
    text = text.strip()
    if not text.endswith('?'):
        return False
    words = text[:-1].strip().split()
    if len(words) < 2:
        return False
    return words[0].lower() not in W_WORDS and words[1].lower() in PERSONAL_PRONOUNS


class AnalyzeRequest(BaseModel):
    text: str


class WordAnalysis(BaseModel):
    text: str
    type: str
    gender: str
    case: str
    number: str
    conjugation_pronoun: str  # Pronoun for verb conjugation (ich, du, er, sie, es, wir, ihr, sie_pl)
    pos: str  # Original POS tag for debugging
    morph: str  # Original morphology for debugging
    clause_type: str  # 'main' or 'subordinate'
    clause_id: int  # Unique identifier for each clause


class GrammarError(BaseModel):
    message: str
    suggestions: List[str]
    offset: int
    length: int
    rule_id: str
    category: str
    context: str


class GrammarCheckResponse(BaseModel):
    text: str
    errors: List[GrammarError]
    error_count: int


def map_pos_to_type(token) -> str:
    """
    Map spaCy POS tags to project word types.

    Types: subject, verb, object, adjective, modal,
           conjunction (subordinating), coord-conjunction (coordinating), preposition, other

    Case (nom/akk/dat/gen) is stored separately in the case field — type only encodes the role.
    """
    pos = token.pos_
    morph_dict = token.morph.to_dict()
    case = morph_dict.get("Case", "")

    # Pronouns → subject (nominative) or object (all other cases)
    if pos == "PRON":
        if case == "Nom":
            return "subject"
        elif case in ("Acc", "Dat", "Gen"):
            return "object"
        return "subject"

    # Modal auxiliaries → modal
    if pos == "AUX":
        lemma = token.lemma_.lower()
        modals = ["können", "müssen", "sollen", "wollen", "dürfen", "mögen", "möchten"]
        if lemma in modals:
            return "modal"
        return "verb"

    # Regular verbs → verb
    if pos == "VERB":
        return "verb"

    # Nouns and proper nouns → subject (nominative) or object (all other cases)
    if pos in ["NOUN", "PROPN"]:
        if case == "Nom":
            return "subject"
        else:
            return "object"

    # Determiners → inherit case from head noun when ambiguous (e.g. "welche" Nom/Acc)
    if pos == "DET":
        effective_case = case
        if token.dep_ == "nk" and token.head.pos_ in ["NOUN", "PROPN"]:
            head_case = token.head.morph.to_dict().get("Case", "")
            if head_case:
                effective_case = head_case

        if effective_case == "Nom":
            return "subject"
        elif effective_case in ("Acc", "Dat", "Gen"):
            return "object"
        else:
            return "other"

    # Adjectives → adjective (case-based shape rendering on frontend)
    if pos == "ADJ":
        return "adjective"

    # Coordinating conjunctions (und, aber, oder, denn, sondern) → coord-conjunction
    if pos == "CCONJ":
        return "coord-conjunction"

    # Subordinating conjunctions (weil, dass, ob, wenn, etc.) → conjunction
    if pos == "SCONJ":
        return "conjunction"

    # Prepositions → preposition
    if pos == "ADP":
        return "preposition"

    # Everything else → other (ADV, NUM, PART, etc.)
    return "other"


def map_gender(morph_dict: Dict) -> str:
    """Map spaCy gender to project format: m, f, n, none"""
    gender = morph_dict.get("Gender", "")

    if gender == "Masc":
        return "m"
    elif gender == "Fem":
        return "f"
    elif gender == "Neut":
        return "n"
    else:
        return "none"


def map_case(morph_dict: Dict) -> str:
    """Map spaCy case to project format: nom, akk, dat, gen"""
    case = morph_dict.get("Case", "")

    if case == "Nom":
        return "nom"
    elif case == "Acc":
        return "akk"
    elif case == "Dat":
        return "dat"
    elif case == "Gen":
        return "gen"
    else:
        return "nom"  # Default to nominative


def map_number(morph_dict: Dict) -> str:
    """Map spaCy number to project format: sg, pl"""
    number = morph_dict.get("Number", "")

    if number == "Plur":
        return "pl"
    else:
        return "sg"  # Default to singular


def map_conjugation_pronoun(token) -> str:
    """
    Determine the pronoun for verb/pronoun conjugation based on morphology.

    Returns: ich, du, er, sie, es, wir, ihr, sie_pl, or none
    """
    morph_dict = token.morph.to_dict()
    pos = token.pos_

    # Only verbs and pronouns have conjugation
    if pos not in ["VERB", "AUX", "PRON"]:
        return "none"

    person = morph_dict.get("Person", "")
    number = morph_dict.get("Number", "")
    gender = morph_dict.get("Gender", "")

    # First person singular → ich
    if person == "1" and number == "Sing":
        return "ich"

    # Second person singular → du
    elif person == "2" and number == "Sing":
        return "du"

    # Third person singular → er/sie/es (depends on gender or token text for pronouns)
    elif person == "3" and number == "Sing":
        # For pronouns, check the actual text
        if pos == "PRON":
            text_lower = token.text.lower()
            if text_lower in ["er", "der"]:
                return "er"
            elif text_lower in ["sie"]:
                return "sie"
            elif text_lower in ["es", "das"]:
                return "es"

        # For verbs, use gender if available
        if gender == "Masc":
            return "er"
        elif gender == "Fem":
            return "sie"
        elif gender == "Neut":
            return "es"
        else:
            # Default to er for third person singular when gender unclear
            return "er"

    # First person plural → wir
    elif person == "1" and number == "Plur":
        return "wir"

    # Second person plural → ihr
    elif person == "2" and number == "Plur":
        return "ihr"

    # Third person plural → sie (plural/formal)
    elif person == "3" and number == "Plur":
        return "sie_pl"

    return "none"


def detect_clauses(doc):
    """
    Detect clause boundaries in a German sentence using dependency parsing.

    Returns a dictionary mapping token index to (clause_type, clause_id):
    - clause_type: 'main' or 'subordinate'
    - clause_id: unique integer for each clause

    Strategy:
    1. Find subordinating conjunctions (SCONJ)
    2. For each SCONJ, identify its subordinate clause span using dependency subtree
    3. Handle coordinating conjunctions (CCONJ) as clause separators for parallel structures
    4. Assign remaining words to main clauses
    """
    # Map token index → (clause_type, clause_id)
    token_to_clause = {}
    clause_counter = 0

    # First, identify subordinate clauses by finding subordinating conjunctions
    subordinate_clauses = []  # List of (conjunction_token, clause_tokens)

    for token in doc:
        if token.pos_ == "SCONJ":
            # This is a subordinating conjunction - it introduces a subordinate clause
            # The subordinate clause includes the conjunction and its syntactic dependents

            # Find the head verb of the subordinate clause
            # The SCONJ typically depends on a verb, and that verb is the head of the subordinate clause
            head = token.head

            # Collect all tokens in the subordinate clause
            # Strategy: Include the conjunction and all tokens that are part of its clause
            subordinate_tokens = set()
            subordinate_tokens.add(token.i)  # Add the conjunction itself

            # If the conjunction has a head that's a verb, include that verb and its dependents
            if head.pos_ in ["VERB", "AUX"]:
                # Add the verb
                subordinate_tokens.add(head.i)

                # Find the first CCONJ after the subordinating conjunction (if any)
                # This marks the end of the subordinate clause
                first_cconj_index = None
                for i in range(token.i + 1, len(doc)):
                    if doc[i].pos_ == "CCONJ":
                        first_cconj_index = i
                        break

                # Add all dependents of the verb (except if they're in another clause)
                for descendant in head.subtree:
                    # Only include tokens that come after or at the conjunction
                    # and before any coordinating conjunction
                    if descendant.i >= token.i:
                        # Stop at coordinating conjunctions - they end the subordinate clause
                        if first_cconj_index is not None and descendant.i >= first_cconj_index:
                            continue
                        subordinate_tokens.add(descendant.i)
            else:
                # If head is not a verb, include tokens from conjunction onwards
                # until we hit another clause boundary or sentence end
                for i in range(token.i, len(doc)):
                    if doc[i].pos_ == "SCONJ" and i != token.i:
                        # Another subordinating conjunction - stop here
                        break
                    subordinate_tokens.add(i)

            subordinate_clauses.append((token, subordinate_tokens))

    # Assign clause IDs to subordinate clauses
    for conj_token, clause_tokens in subordinate_clauses:
        clause_id = clause_counter
        clause_counter += 1

        for token_idx in clause_tokens:
            if token_idx not in token_to_clause:
                token_to_clause[token_idx] = ("subordinate", clause_id)

    # Assign remaining tokens to main clause(s)
    # Handle coordinating conjunctions as separators between parallel main clauses
    current_main_clause_id = clause_counter
    clause_counter += 1

    for token in doc:
        if token.i not in token_to_clause and not token.is_punct:
            # Check if this is a coordinating conjunction that splits main clauses
            if token.pos_ == "CCONJ":
                # Start a new main clause after this conjunction
                token_to_clause[token.i] = ("main", current_main_clause_id)
                current_main_clause_id = clause_counter
                clause_counter += 1
            else:
                token_to_clause[token.i] = ("main", current_main_clause_id)

    return token_to_clause


@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "message": "German NLP Analyzer API",
        "model": "de_core_news_sm"
    }


@app.post("/analyze", response_model=List[WordAnalysis])
def analyze_sentence(request: AnalyzeRequest):
    """
    Analyze a German sentence and return word-level linguistic information.

    Returns:
    - text: The word text
    - type: subject, verb, object, adjective, modal, conjunction (subordinating), coord-conjunction (coordinating), preposition, other
    - gender: m, f, n, none
    - case: nom, akk, dat, gen
    - number: sg, pl
    - conjugation_pronoun: Pronoun for verb conjugation
    - pos: Original spaCy POS tag (for debugging)
    - morph: Original morphology string (for debugging)
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        # For V1 questions where spaCy completely fails (first token pos=X), reorder to SVO.
        # e.g. "Sprichst du Deutsch?" → "Du sprichst Deutsch?" so spaCy parses correctly.
        # We do a quick pre-parse first to check — only reorder when truly needed.
        parse_text = request.text.strip()
        v1_orig_words = None

        if detect_v1_question(parse_text):
            probe = nlp(parse_text)
            first_content = next((t for t in probe if not t.is_punct), None)
            if first_content and first_content.pos_ == "X":
                body_words = parse_text[:-1].strip().split()
                v1_orig_words = body_words
                reordered = (
                    [body_words[1].capitalize()]
                    + [body_words[0].lower()]
                    + body_words[2:]
                )
                parse_text = ' '.join(reordered) + '?'

        # Process the text with spaCy
        doc = nlp(parse_text)

        # Build a map of predicate tokens to their subjects.
        # Covers VERB/AUX and ROOT tokens that have sb children but were misclassified
        # (e.g. "Magst" getting pos=ADV in "Magst du Kaffee?").
        verb_subject_map = {}
        for token in doc:
            is_predicate = token.pos_ in ["VERB", "AUX"] or (
                token.dep_ == "ROOT"
                and any(c.dep_ in ["sb", "ep"] for c in token.children)
            )
            if is_predicate:
                # Find the subject of this verb
                # 'sb' = subject, 'ep' = expletive pronoun (like "Es regnet")
                for child in token.children:
                    if child.dep_ in ["sb", "ep"]:
                        verb_subject_map[token.i] = child
                        break

        # Detect clause boundaries
        token_to_clause = detect_clauses(doc)

        # Analyze each token
        results = []
        for token in doc:
            # Skip punctuation
            if token.is_punct:
                continue

            # Extract morphological features
            morph_dict = token.morph.to_dict()

            # Determine conjugation pronoun
            conj_pronoun = map_conjugation_pronoun(token)

            # For predicate tokens (VERB/AUX or misclassified ROOT with subject), determine
            # conjugation from the verb's morphology + subject info.
            if token.i in verb_subject_map:
                subject = verb_subject_map[token.i]
                verb_person = morph_dict.get("Person", "")
                verb_number = morph_dict.get("Number", "")

                # Use verb's Person and Number to determine conjugation
                if verb_person == "1" and verb_number == "Sing":
                    conj_pronoun = "ich"
                elif verb_person == "2" and verb_number == "Sing":
                    conj_pronoun = "du"
                elif verb_person == "3" and verb_number == "Sing":
                    # For 3rd person singular, check subject's gender/text
                    subject_text = subject.text.lower()
                    subject_morph = subject.morph.to_dict()
                    subject_person = subject_morph.get("Person", "")
                    subject_gender = subject_morph.get("Gender", "")

                    # spaCy sometimes assigns Person=3 to verb forms shared by 2nd and 3rd
                    # person (e.g. "heißt", "kommst"). Use the subject's own Person morph
                    # as a correction when the subject is a known pronoun.
                    if subject_person == "2":
                        conj_pronoun = "du"
                    elif subject_text in ["sie"]:
                        conj_pronoun = "sie"  # she (singular feminine)
                    elif subject_text in ["es", "das"]:
                        conj_pronoun = "es"
                    elif subject_text in ["er", "der"]:
                        conj_pronoun = "er"
                    elif subject_gender == "Fem":
                        conj_pronoun = "sie"
                    elif subject_gender == "Neut":
                        conj_pronoun = "es"
                    elif subject_gender == "Masc":
                        conj_pronoun = "er"
                    else:
                        conj_pronoun = "er"  # default
                elif verb_person == "1" and verb_number == "Plur":
                    conj_pronoun = "wir"
                elif verb_person == "2" and verb_number == "Plur":
                    conj_pronoun = "ihr"
                elif verb_person == "3" and verb_number == "Plur":
                    conj_pronoun = "sie_pl"
                else:
                    # Fallback to subject's conjugation
                    conj_pronoun = map_conjugation_pronoun(subject)

            # Get clause information
            clause_type, clause_id = token_to_clause.get(token.i, ("main", 0))

            word_type = map_pos_to_type(token)
            # If spaCy misclassified a predicate token (has a subject but wrong POS),
            # override the type to "verb" so it renders correctly.
            if token.i in verb_subject_map and word_type not in ["verb", "modal"]:
                word_type = "verb"

            word_analysis = WordAnalysis(
                text=token.text,
                type=word_type,
                gender=map_gender(morph_dict),
                case=map_case(morph_dict),
                number=map_number(morph_dict),
                conjugation_pronoun=conj_pronoun,
                pos=token.pos_,
                morph=str(token.morph),
                clause_type=clause_type,
                clause_id=clause_id
            )

            results.append(word_analysis)

        # If we reordered a V1 question, restore original word order and original casing.
        # results[0] = subject (reordered pos 0, orig pos 1)
        # results[1] = verb   (reordered pos 1, orig pos 0)
        # results[2..n] = rest (unchanged)
        if v1_orig_words and len(results) >= 2:
            reorder_map = {0: 1, 1: 0, **{i: i for i in range(2, len(v1_orig_words))}}
            remapped = [None] * len(results)
            for new_idx, word in enumerate(results):
                orig_idx = reorder_map.get(new_idx, new_idx)
                if orig_idx < len(v1_orig_words):
                    word.text = v1_orig_words[orig_idx]
                remapped[orig_idx] = word
            results = [r for r in remapped if r is not None]

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@app.post("/analyze/debug", response_model=List[Dict])
def analyze_debug(request: AnalyzeRequest):
    """
    Debug endpoint that returns full spaCy analysis.
    Useful for understanding what spaCy detects.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        doc = nlp(request.text)

        results = []
        for token in doc:
            results.append({
                "text": token.text,
                "lemma": token.lemma_,
                "pos": token.pos_,
                "tag": token.tag_,
                "dep": token.dep_,
                "morph": str(token.morph),
                "morph_dict": token.morph.to_dict(),
                "is_punct": token.is_punct,
                "is_stop": token.is_stop
            })

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@app.post("/check-grammar", response_model=GrammarCheckResponse)
def check_grammar(request: AnalyzeRequest):
    """
    Check German grammar and spelling using LanguageTool Public API.

    Returns:
    - text: The original text
    - errors: List of grammar/spelling errors found
    - error_count: Total number of errors

    Each error includes:
    - message: Description of the error
    - suggestions: Possible corrections
    - offset: Character position where error starts
    - length: Length of the error in characters
    - rule_id: LanguageTool rule identifier
    - category: Error category (e.g., GRAMMAR, TYPOS)
    - context: Text snippet showing the error in context
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        # Call LanguageTool Public API
        print(f"Checking grammar for text: {request.text[:50]}...")
        sys.stdout.flush()

        response = requests.post(
            LANGUAGETOOL_API_URL,
            data={
                'text': request.text,
                'language': 'de-DE'
            },
            timeout=10
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"LanguageTool API error: {response.text}"
            )

        result = response.json()
        matches = result.get('matches', [])

        print(f"API returned {len(matches)} matches")
        sys.stdout.flush()

        # Convert matches to our response format
        errors = []
        for match in matches:
            # Get context (text around the error)
            offset = match.get('offset', 0)
            length = match.get('length', 0)
            context_start = max(0, offset - 20)
            context_end = min(len(request.text), offset + length + 20)
            context = request.text[context_start:context_end]

            # Get suggestions
            replacements = match.get('replacements', [])
            suggestions = [r.get('value', '') for r in replacements[:5]]

            error = GrammarError(
                message=match.get('message', ''),
                suggestions=suggestions,
                offset=offset,
                length=length,
                rule_id=match.get('rule', {}).get('id', ''),
                category=match.get('rule', {}).get('category', {}).get('id', ''),
                context=context
            )
            errors.append(error)

        response_data = GrammarCheckResponse(
            text=request.text,
            errors=errors,
            error_count=len(errors)
        )
        print(f"Returning response with {len(errors)} errors")
        sys.stdout.flush()
        return response_data

    except requests.RequestException as e:
        print(f"LanguageTool API request error: {str(e)}")
        sys.stdout.flush()
        raise HTTPException(
            status_code=503,
            detail="Grammar check service temporarily unavailable. Please try again."
        )

    except Exception as e:
        print(f"EXCEPTION in grammar check: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=f"Grammar check error: {str(e)}")


@app.get("/word-info/{word}")
def get_word_information(word: str):
    """
    Get dictionary information for a German word from Wiktionary.

    Returns comprehensive word information including:
    - Case requirements (e.g., "mit Dativ" for verbs)
    - Definition in German
    - Example sentences
    - Usage notes

    Args:
    - word: German word to look up (will be lemmatized automatically)

    Returns:
    - word: The queried word (original form)
    - lemma: The lemmatized form used for lookup
    - found: Whether the word was found in Wiktionary
    - cases: List of case requirements (e.g., ["mit Dativ"])
    - definition: First definition from Wiktionary
    - examples: Up to 3 example sentences
    - note: User-friendly explanation of case requirements
    """
    try:
        from wiktionary_api import get_word_info
        from dictcc_api import fetch_dictcc_translations
        from tatoeba_api import fetch_tatoeba_examples

        # Lemmatize the word using spaCy to get the base form
        doc = nlp(word)
        lemma = doc[0].lemma_ if len(doc) > 0 else word

        # Look up the lemma in Wiktionary (for grammar info)
        info = get_word_info(lemma)

        # Get simple English translations from dict.cc
        dictcc_translations = fetch_dictcc_translations(lemma, max_results=5)

        # Extract just the English translations for simple display
        simple_translations = [entry["en"] for entry in dictcc_translations]

        # Get simple example sentences from Tatoeba (instead of Wiktionary)
        tatoeba_examples = fetch_tatoeba_examples(lemma, max_results=3)

        # Add dict.cc translations and full entries to the response
        info['translations'] = simple_translations  # Simple English translations
        info['translation_entries'] = dictcc_translations  # Full entries with DE-EN pairs

        # Replace Wiktionary examples with simpler Tatoeba examples
        info['examples'] = tatoeba_examples  # Simple DE-EN sentence pairs

        # Add the original word and lemma to the response
        info['original_word'] = word
        info['lemma'] = lemma

        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Word lookup error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
