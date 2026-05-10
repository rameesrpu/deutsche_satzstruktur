from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spacy
import language_tool_python
from typing import List, Dict
import sys
import subprocess

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

# Initialize LanguageTool for German grammar checking
# Using lazy initialization to handle subprocess issues
language_tool = None

def get_language_tool():
    """Get or create LanguageTool instance with error handling"""
    global language_tool
    try:
        # Check if instance exists and is healthy
        if language_tool is not None:
            # Try to check if subprocess is alive
            if hasattr(language_tool, '_server') and language_tool._server is not None:
                poll_result = language_tool._server.poll()
                if poll_result is None:  # None means process is still running
                    return language_tool
                else:
                    print(f"LanguageTool subprocess died with code {poll_result}, recreating...")
                    language_tool = None
            else:
                print("LanguageTool subprocess is None, recreating...")
                language_tool = None

        # Create new instance
        print("Initializing LanguageTool for German...")
        sys.stdout.flush()

        language_tool = language_tool_python.LanguageTool('de-DE')

        # Verify the server started properly
        if not hasattr(language_tool, '_server') or language_tool._server is None:
            raise RuntimeError("LanguageTool server failed to start - subprocess is None")

        print(f"LanguageTool ready! Server PID: {language_tool._server.pid if hasattr(language_tool._server, 'pid') else 'unknown'}")
        sys.stdout.flush()
        return language_tool
    except Exception as e:
        print(f"LanguageTool initialization error: {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        raise


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

    Types: subject, verb, object, object-akk, object-dat, object-gen, adjective, modal,
           conjunction (subordinating), coord-conjunction (coordinating), preposition, other

    Enhanced to distinguish between different object types based on case and conjunction types.
    """
    pos = token.pos_
    morph_dict = token.morph.to_dict()
    case = morph_dict.get("Case", "")

    # Pronouns (especially personal pronouns) → subject (unless dative/accusative)
    if pos == "PRON":
        # Personal pronouns in nominative are subjects
        if case == "Nom":
            return "subject"
        # Accusative pronouns are objects
        elif case == "Acc":
            return "object-akk"
        # Dative pronouns are indirect objects
        elif case == "Dat":
            return "object-dat"
        # Genitive pronouns
        elif case == "Gen":
            return "object-gen"
        # Default to subject if case is unclear
        return "subject"

    # Modal auxiliaries → modal
    if pos == "AUX":
        # Check if it's a modal verb (können, müssen, sollen, wollen, dürfen, mögen)
        lemma = token.lemma_.lower()
        modals = ["können", "müssen", "sollen", "wollen", "dürfen", "mögen", "möchten"]
        if lemma in modals:
            return "modal"
        return "verb"

    # Regular verbs → verb
    if pos == "VERB":
        return "verb"

    # Nouns and proper nouns → case-specific object types
    if pos in ["NOUN", "PROPN"]:
        # Distinguish based on grammatical case
        if case == "Nom":
            return "subject"  # Nominative nouns are subjects
        elif case == "Acc":
            return "object-akk"  # Accusative nouns are direct objects
        elif case == "Dat":
            return "object-dat"  # Dative nouns are indirect objects
        elif case == "Gen":
            return "object-gen"  # Genitive nouns show possession
        else:
            return "object"  # Default to generic object if case unclear

    # Determiners (articles) → also use case-specific types for proper shape rendering
    if pos == "DET":
        # Map determiners to same case-specific types as nouns
        if case == "Nom":
            return "subject"
        elif case == "Acc":
            return "object-akk"
        elif case == "Dat":
            return "object-dat"
        elif case == "Gen":
            return "object-gen"
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
        # Process the text with spaCy
        doc = nlp(request.text)

        # Build a map of verbs to their subjects for better conjugation detection
        verb_subject_map = {}
        for token in doc:
            if token.pos_ in ["VERB", "AUX"]:
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

            # For verbs, use the VERB's morphology (Person+Number) combined with subject info
            # This is more reliable because verb conjugations are unambiguous in German
            if token.pos_ in ["VERB", "AUX"] and token.i in verb_subject_map:
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
                    subject_gender = subject_morph.get("Gender", "")

                    if subject_text in ["sie"]:
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

            word_analysis = WordAnalysis(
                text=token.text,
                type=map_pos_to_type(token),
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
    Check German grammar and spelling using LanguageTool.

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
        # Get LanguageTool instance (lazy initialization)
        lt = get_language_tool()

        # Debug logging
        print(f"Checking grammar for text: {request.text[:50]}...")
        print(f"LanguageTool server status: {lt._server}")

        # Check the text with LanguageTool
        matches = lt.check(request.text)

        # Convert matches to our response format
        errors = []
        for match in matches:
            # Get context (text around the error)
            context_start = max(0, match.offset - 20)
            context_end = min(len(request.text), match.offset + match.errorLength + 20)
            context = request.text[context_start:context_end]

            error = GrammarError(
                message=match.message,
                suggestions=match.replacements[:5],  # Limit to top 5 suggestions
                offset=match.offset,
                length=match.errorLength,
                rule_id=match.ruleId,
                category=match.category,
                context=context
            )
            errors.append(error)

        return GrammarCheckResponse(
            text=request.text,
            errors=errors,
            error_count=len(errors)
        )

    except Exception as e:
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
