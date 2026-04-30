# Auto-Configure Feature Setup Guide

This guide explains how to use the automatic word configuration feature powered by AI.

## What Does Auto-Configure Do?

The Auto-Configure feature automatically analyzes your German sentences and identifies:

- **Word Type**: verb, noun, subject, modal, conjunction, preposition, etc.
- **Gender**: masculine, feminine, neuter
- **Case**: nominative, accusative, dative, genitive
- **Number**: singular, plural

This saves you from manually configuring each word!

## Quick Start

### Step 1: Start the Backend Server

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment (first time only):
   ```bash
   python -m venv venv

   # On Linux/Mac:
   source venv/bin/activate

   # On Windows:
   venv\Scripts\activate
   ```

3. Install dependencies (first time only):
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python app.py
   ```

   You should see:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000
   INFO:     Application startup complete.
   ```

### Step 2: Open the Application

1. Open [index.html](index.html) in your web browser
2. Or use a local server (recommended):
   ```bash
   # If you have Python:
   python -m http.server 5500
   # Then open: http://localhost:5500

   # Or use VS Code Live Server extension
   ```

### Step 3: Use Auto-Configure

1. **Add a sentence** in the text area:
   ```
   Ich gebe dem Mann einen Apfel
   ```

2. Click **"Add Sentence"**

3. Click **"Auto-Configure Words"** (blue button)

4. Wait a moment while the AI analyzes the sentence

5. The words will be automatically configured! For example:
   - "Ich" → subject, nominative, singular
   - "gebe" → verb
   - "Mann" → object, masculine, dative, singular
   - "Apfel" → object, masculine, accusative, singular

6. You can still manually adjust any word by clicking on it

## Example Sentences to Try

```
Ich lese ein Buch
Der Hund bellt laut
Sie gibt dem Kind das Spielzeug
Wir haben gestern einen Film gesehen
Der Mann, der dort sitzt, ist mein Vater
```

## Troubleshooting

### "Cannot connect to backend" Error

**Problem**: The frontend can't reach the backend server.

**Solution**:
1. Make sure the backend server is running (see Step 1)
2. Check that it's running on port 8000
3. Look for this in the terminal:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

### "No sentence is currently loaded" Error

**Problem**: You haven't added or loaded a sentence yet.

**Solution**:
1. Type a sentence in the text area
2. Click "Add Sentence"
3. Then click "Auto-Configure Words"

### Words Not Configured Correctly

**Problem**: The AI sometimes makes mistakes (it's about 90-96% accurate).

**Solution**:
1. You can manually adjust any word's properties by clicking on it
2. The properties panel on the right lets you change:
   - Word type
   - Gender
   - Case
   - Number
   - Flow direction

### Different Port

**Problem**: Port 8000 is already in use.

**Solution**:
1. Change the port in [backend/app.py](backend/app.py):
   ```python
   uvicorn.run(app, host="0.0.0.0", port=8001)  # Use 8001 instead
   ```

2. Update [js/sentenceManager.js](js/sentenceManager.js) line 260:
   ```javascript
   async autoConfigureCurrentSentence(backendUrl = 'http://localhost:8001')
   ```

## How It Works

```
┌─────────────────┐
│  Your Browser   │  1. Click "Auto-Configure"
│  (Frontend)     │
└────────┬────────┘
         │ 2. Send sentence text via HTTP
         ▼
┌─────────────────┐
│  Python Server  │  3. Analyze with spaCy AI
│  (Backend)      │     German language model
└────────┬────────┘
         │ 4. Return word properties (JSON)
         ▼
┌─────────────────┐
│  Your Browser   │  5. Update word configurations
│  (Frontend)     │     and redraw visualization
└─────────────────┘
```

## Performance Tips

### Use Larger Model (Optional)

For better accuracy, use the large German model:

1. Install it:
   ```bash
   python -m spacy download de_core_news_lg
   ```

2. Update [backend/app.py](backend/app.py) line 18:
   ```python
   nlp = spacy.load("de_core_news_lg")  # Changed from de_core_news_sm
   ```

**Trade-off**: Larger model = better accuracy but slower processing and 500MB download.

### Keep Server Running

While working on sentences, keep the backend server running in a separate terminal window. This way you can auto-configure multiple sentences without restarting.

## What Gets Configured

| Property | How It's Detected | Accuracy |
|----------|-------------------|----------|
| **Word Type** | spaCy POS tagging | ~96% |
| **Gender** | Morphological analysis | ~90% |
| **Case** | Morphological analysis | ~90% |
| **Number** | Morphological analysis | ~95% |

**Note**: Conjugation/pronoun is not auto-configured yet. You can set it manually.

## Next Steps

Once your words are auto-configured, you can:

1. **Fine-tune manually**: Click any word to adjust its properties
2. **Position words**: Drag words to the correct Feldermodell positions
3. **Change flow direction**: Switch between Hauptsatz (horizontal) and Nebensatz (vertical)
4. **Save your work**: The configuration is automatically saved to localStorage

## Getting Help

- **Backend documentation**: See [backend/README.md](backend/README.md)
- **API testing**: Visit http://localhost:8000/docs for interactive API documentation
- **Debug endpoint**: Use `/analyze/debug` to see full spaCy analysis

Enjoy automatic word configuration!
