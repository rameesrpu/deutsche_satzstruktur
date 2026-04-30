# German NLP Backend with spaCy

This backend provides automatic linguistic analysis for German sentences using spaCy's German language model.

## Features

- **POS Tagging**: Identifies word types (verbs, nouns, pronouns, etc.)
- **Morphological Analysis**: Extracts gender, case, and number
- **Fast Processing**: Uses spaCy's efficient German model
- **REST API**: Easy integration with the frontend

## Setup Instructions

### 1. Install Python

Make sure you have Python 3.8+ installed:

```bash
python --version
# or
python3 --version
```

### 2. Create Virtual Environment (Recommended)

```bash
# Navigate to the backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Download German spaCy Model

The German model will be automatically downloaded on first run, but you can also install it manually:

```bash
python -m spacy download de_core_news_sm
```

For better accuracy, you can use the larger model (optional):

```bash
python -m spacy download de_core_news_lg
```

Then update [app.py](app.py) line 18 to use `de_core_news_lg` instead of `de_core_news_sm`.

### 5. Run the Server

```bash
python app.py
```

Or use uvicorn directly:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The server will start at: **http://localhost:8000**

## API Endpoints

### 1. Health Check

```
GET /
```

Returns server status and model information.

**Response:**
```json
{
  "status": "running",
  "message": "German NLP Analyzer API",
  "model": "de_core_news_sm"
}
```

### 2. Analyze Sentence

```
POST /analyze
```

Analyzes a German sentence and returns linguistic properties for each word.

**Request Body:**
```json
{
  "text": "Ich gebe dem Mann einen Apfel"
}
```

**Response:**
```json
[
  {
    "text": "Ich",
    "type": "subject",
    "gender": "none",
    "case": "nom",
    "number": "sg",
    "pos": "PRON",
    "morph": "Case=Nom|Number=Sing|Person=1|PronType=Prs"
  },
  {
    "text": "gebe",
    "type": "verb",
    "gender": "none",
    "case": "nom",
    "number": "sg",
    "pos": "VERB",
    "morph": "Mood=Ind|Number=Sing|Person=1|Tense=Pres|VerbForm=Fin"
  },
  {
    "text": "dem",
    "type": "other",
    "gender": "m",
    "case": "dat",
    "number": "sg",
    "pos": "DET",
    "morph": "Case=Dat|Definite=Def|Gender=Masc|Number=Sing|PronType=Art"
  },
  {
    "text": "Mann",
    "type": "object",
    "gender": "m",
    "case": "dat",
    "number": "sg",
    "pos": "NOUN",
    "morph": "Case=Dat|Gender=Masc|Number=Sing"
  },
  {
    "text": "einen",
    "type": "other",
    "gender": "m",
    "case": "akk",
    "number": "sg",
    "pos": "DET",
    "morph": "Case=Acc|Definite=Ind|Gender=Masc|Number=Sing|PronType=Art"
  },
  {
    "text": "Apfel",
    "type": "object",
    "gender": "m",
    "case": "akk",
    "number": "sg",
    "pos": "NOUN",
    "morph": "Case=Acc|Gender=Masc|Number=Sing"
  }
]
```

### 3. Debug Endpoint

```
POST /analyze/debug
```

Returns full spaCy analysis with all linguistic features (useful for debugging).

**Request Body:**
```json
{
  "text": "Der Hund bellt"
}
```

**Response:**
```json
[
  {
    "text": "Der",
    "lemma": "der",
    "pos": "DET",
    "tag": "ART",
    "dep": "nk",
    "morph": "Case=Nom|Definite=Def|Gender=Masc|Number=Sing|PronType=Art",
    "morph_dict": {
      "Case": ["Nom"],
      "Definite": ["Def"],
      "Gender": ["Masc"],
      "Number": ["Sing"],
      "PronType": ["Art"]
    },
    "is_punct": false,
    "is_stop": true
  }
]
```

## Word Type Mapping

The API maps spaCy POS tags to the project's word types:

| spaCy POS | Project Type | Description |
|-----------|--------------|-------------|
| PRON | subject | Personal pronouns (ich, du, er, sie, es) |
| AUX (modal) | modal | Modal verbs (können, müssen, sollen, etc.) |
| AUX (other) | verb | Auxiliary verbs |
| VERB | verb | Main verbs |
| NOUN, PROPN | object | Nouns and proper nouns |
| CCONJ, SCONJ | conjunction | Coordinating and subordinating conjunctions |
| ADP | preposition | Prepositions |
| Others | other | Adjectives, adverbs, determiners, etc. |

## Morphological Features

### Gender
- `m` = Masculine (Masc)
- `f` = Feminine (Fem)
- `n` = Neuter (Neut)
- `none` = No gender or unknown

### Case
- `nom` = Nominative (Nom)
- `akk` = Accusative (Acc)
- `dat` = Dative (Dat)
- `gen` = Genitive (Gen)

### Number
- `sg` = Singular (Sing)
- `pl` = Plural (Plur)

## Troubleshooting

### Port Already in Use

If port 8000 is already in use, change it in [app.py](app.py):

```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Changed to 8001
```

Then update the frontend to use the new port in [sentenceManager.js](../js/sentenceManager.js):

```javascript
async autoConfigureCurrentSentence(backendUrl = 'http://localhost:8001')
```

### CORS Issues

If you encounter CORS errors, make sure the frontend URL is in the allowed origins in [app.py](app.py):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],  # Add your URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Model Not Found

If you get "Model not found" error:

```bash
python -m spacy download de_core_news_sm
```

## Development

### Running with Auto-Reload

```bash
uvicorn app:app --reload
```

This will automatically restart the server when you make code changes.

### Testing the API

You can test the API using curl:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Ich lese ein Buch"}'
```

Or use the interactive API docs at: **http://localhost:8000/docs**

## Performance

- **Model Size**: de_core_news_sm (~15MB), de_core_news_lg (~500MB)
- **Processing Speed**: ~1MB text per second
- **Accuracy**: 96%+ for POS tagging, 90%+ for morphology

## License

This backend uses:
- **FastAPI** - MIT License
- **spaCy** - MIT License
- **German spaCy models** - MIT License
