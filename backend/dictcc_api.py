"""
Dict.cc API Integration - Fetch simple English translations for German words
"""
import requests
import re
from typing import List, Dict, Optional
from bs4 import BeautifulSoup


def fetch_dictcc_translations(word: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Fetch German-English translations from dict.cc

    Returns list of translation pairs:
    [
        {"de": "helfen", "en": "to help"},
        {"de": "helfen", "en": "to assist"},
        ...
    ]
    """
    try:
        url = f"https://www.dict.cc/?s={word}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        response = requests.get(url, headers=headers, timeout=5)

        if response.status_code != 200:
            return []

        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')

        translations = []

        # Find translation table rows
        # dict.cc uses <tr> elements with id like "tr1", "tr2", etc.
        rows = soup.find_all('tr', id=re.compile(r'tr\d+'))

        for row in rows[:max_results * 2]:  # Get more rows as some might be filtered out
            # Find all td7nl cells (typically 2 per row: English and German)
            cells = row.find_all('td', class_='td7nl')

            if len(cells) >= 2:
                # First td7nl is English, second is German
                en_cell = cells[0]
                de_cell = cells[1]

                # Extract text with proper spacing between elements
                en_text = en_cell.get_text(separator=' ', strip=True)
                de_text = de_cell.get_text(separator=' ', strip=True)

                # Remove vote numbers (usually at the end) - numbers followed by optional whitespace
                de_text = re.sub(r'\s*\d+\s*$', '', de_text).strip()
                en_text = re.sub(r'\s*\d+\s*$', '', en_text).strip()

                # Remove metadata in brackets and curly braces
                de_text = re.sub(r'\{[^}]+\}|\[[^\]]+\]', '', de_text).strip()
                en_text = re.sub(r'\{[^}]+\}|\[[^\]]+\]', '', en_text).strip()

                # Clean up extra whitespace
                de_text = ' '.join(de_text.split())
                en_text = ' '.join(en_text.split())

                # Skip empty or very long entries
                if de_text and en_text and len(de_text) < 100 and len(en_text) < 100:
                    translations.append({
                        "de": de_text,
                        "en": en_text
                    })

                    if len(translations) >= max_results:
                        break

        return translations

    except Exception as e:
        print(f"Dict.cc fetch error for '{word}': {e}")
        return []


def get_simple_translations(word: str) -> Dict:
    """
    Get learner-friendly translations from dict.cc

    Returns:
    {
        "word": str,
        "found": bool,
        "translations": List[str],  # List of English translations
        "full_entries": List[Dict]  # Full translation pairs with context
    }
    """
    translations_data = fetch_dictcc_translations(word)

    if not translations_data:
        return {
            "word": word,
            "found": False,
            "translations": [],
            "full_entries": []
        }

    # Extract just the English translations for simple display
    simple_translations = [entry["en"] for entry in translations_data]

    return {
        "word": word,
        "found": True,
        "translations": simple_translations,
        "full_entries": translations_data
    }
