"""
Tatoeba API Integration - Fetch simple example sentences for German words
Tatoeba is a collection of sentences and translations for language learners
"""
import requests
from typing import List, Dict


def fetch_tatoeba_examples(word: str, max_results: int = 3) -> List[Dict[str, str]]:
    """
    Fetch simple example sentences from Tatoeba

    Returns list of examples:
    [
        {"de": "Ich helfe dir.", "en": "I'll help you."},
        {"de": "Kannst du mir helfen?", "en": "Can you help me?"},
        ...
    ]
    """
    try:
        # Tatoeba search API
        url = "https://tatoeba.org/en/api_v0/search"
        params = {
            "from": "deu",  # German
            "to": "eng",    # English
            "query": word,
            "orphans": "no",
            "unapproved": "no",
            "trans_filter": "limit",
            "trans_to": "eng",
            "sort": "relevance"
        }

        headers = {
            "User-Agent": "DeutschGrammarApp/1.0 (Educational language learning tool)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=5)

        if response.status_code != 200:
            return []

        data = response.json()
        examples = []

        # Extract results
        if "results" in data:
            for result in data["results"][:max_results * 2]:  # Get more to filter
                de_text = result.get("text", "").strip()

                # Get English translation
                # translations is a list of lists, each inner list contains translation objects
                translations = result.get("translations", [])
                if translations and len(translations) > 0:
                    # Get first English translation from first translation group
                    for trans_group in translations:
                        if trans_group and len(trans_group) > 0:
                            first_trans = trans_group[0]
                            if first_trans.get("lang") == "eng":
                                en_text = first_trans.get("text", "").strip()

                                # Only include shorter, simpler sentences
                                if de_text and en_text and len(de_text) < 100 and len(en_text) < 100:
                                    examples.append({
                                        "de": de_text,
                                        "en": en_text
                                    })
                                    break

                if len(examples) >= max_results:
                    break

        return examples

    except Exception as e:
        print(f"Tatoeba fetch error for '{word}': {e}")
        return []


def get_example_sentences(word: str) -> Dict:
    """
    Get simple example sentences from Tatoeba

    Returns:
    {
        "word": str,
        "found": bool,
        "examples": List[Dict]  # List of DE-EN sentence pairs
    }
    """
    examples = fetch_tatoeba_examples(word, max_results=3)

    return {
        "word": word,
        "found": len(examples) > 0,
        "examples": examples
    }
