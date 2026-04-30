from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spacy
from typing import List, Dict

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

            # For verbs, if we have a subject, use the subject's conjugation
            if token.pos_ in ["VERB", "AUX"] and token.i in verb_subject_map:
                subject = verb_subject_map[token.i]
                conj_pronoun = map_conjugation_pronoun(subject)

            word_analysis = WordAnalysis(
                text=token.text,
                type=map_pos_to_type(token),
                gender=map_gender(morph_dict),
                case=map_case(morph_dict),
                number=map_number(morph_dict),
                conjugation_pronoun=conj_pronoun,
                pos=token.pos_,
                morph=str(token.morph)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
