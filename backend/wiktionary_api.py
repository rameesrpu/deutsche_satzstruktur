"""
Wiktionary API Integration - Extract grammar info from German Wiktionary
"""
import requests
import re
import mwparserfromhell
from typing import Dict, Optional, List


def fetch_wiktionary_wikitext(word: str) -> Optional[str]:
    """Fetch the wikitext from German Wiktionary"""
    try:
        url = "https://de.wiktionary.org/w/api.php"
        params = {
            "action": "parse",
            "page": word,
            "prop": "wikitext",
            "format": "json",
            "formatversion": 2
        }

        # Set User-Agent as required by Wikimedia API policy
        headers = {
            "User-Agent": "DeutschGrammarApp/1.0 (Educational tool for German language learning)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()

        if "parse" in data:
            return data["parse"]["wikitext"]

        return None
    except Exception as e:
        print(f"Wiktionary fetch error for '{word}': {e}")
        return None


def parse_case_requirements(wikitext: str) -> List[str]:
    """
    Extract case requirements from Wiktionary wikitext

    Returns list of case patterns like: ["mit Dativ", "mit Akkusativ"]
    """
    cases = []

    # Find the Bedeutungen (meanings) section
    bedeutungen_match = re.search(r'{{Bedeutungen}}(.*?)(?:{{|$)', wikitext, re.DOTALL)
    if not bedeutungen_match:
        return cases

    meanings_section = bedeutungen_match.group(1)

    # Look for case patterns in parentheses at start of definitions
    # Pattern: :[number] (mit Dativ)  or  (mit Akkusativ) etc.
    case_patterns = re.findall(r':\[\d+\]\s*\((mit [^)]+)\)', meanings_section)

    for pattern in case_patterns:
        # Clean up the pattern
        pattern = pattern.strip()

        if pattern not in cases:
            cases.append(pattern)

    return cases


def parse_examples(wikitext: str) -> List[str]:
    """Extract example sentences from Wiktionary using mwparserfromhell"""
    examples = []

    # Find examples section
    beispiele_match = re.search(r'{{Beispiele}}(.*?)(?:{{|$)', wikitext, re.DOTALL)
    if not beispiele_match:
        return examples

    examples_section = beispiele_match.group(1)

    # Extract examples (format: :[1] Example sentence.) - preserve numbering
    example_patterns = re.findall(r'(:\[\d+\]\s*[^<\n][^\n]+?)(?:\n|$)', examples_section)

    for example in example_patterns[:3]:  # Limit to 3 examples
        try:
            # Parse with mwparserfromhell to clean up properly
            wikicode = mwparserfromhell.parse(example)

            # Strip wiki links but keep text
            for wikilink in wikicode.filter_wikilinks():
                display_text = str(wikilink.text) if wikilink.text else str(wikilink.title)
                wikicode.replace(wikilink, display_text)

            # Convert to string and clean up
            cleaned = str(wikicode)
            cleaned = re.sub(r'<ref[^>]*>.*?</ref>', '', cleaned, flags=re.DOTALL)
            cleaned = cleaned.replace("''", "")
            cleaned = cleaned.strip()

            if cleaned and len(cleaned) > 10:  # Skip very short ones
                examples.append(cleaned)

        except Exception:
            # Fallback to simple cleanup
            example = re.sub(r'<ref>.*?</ref>', '', example)
            example = example.replace("''", "")
            example = example.strip()
            if example and len(example) > 10:
                examples.append(example)

    return examples


def parse_gender(wikitext: str) -> Optional[str]:
    """
    Extract gender from Wiktionary wikitext for nouns using mwparserfromhell

    Returns: 'm' (masculine), 'f' (feminine), 'n' (neuter), 'pl' (plural), or None
    """
    # Look for gender markers in the first few lines (usually in the header)
    header = wikitext[:500]

    try:
        wikicode = mwparserfromhell.parse(header)

        # Check for explicit gender templates
        for template in wikicode.filter_templates():
            template_name = str(template.name).strip()

            # Direct gender templates
            if template_name == 'm':
                return 'm'
            elif template_name == 'f':
                return 'f'
            elif template_name == 'n':
                return 'n'
            elif template_name in ['Pl', 'Pl.']:
                return 'pl'

            # Check for Genus parameter in templates
            if template.has('Genus'):
                genus = str(template.get('Genus').value).strip()
                if genus in ['m', 'f', 'n']:
                    return genus

        # Fallback to regex patterns
        genus_match = re.search(r'Genus=([mfn])', header)
        if genus_match:
            return genus_match.group(1)

        article_match = re.search(r'\{\{Wortart\|Substantiv\|Deutsch\}\},\s*\{\{([mfn])\}\}', header)
        if article_match:
            return article_match.group(1)

    except Exception:
        # Fallback to simple regex if parsing fails
        if re.search(r'\{\{m\}\}', header):
            return 'm'
        if re.search(r'\{\{f\}\}', header):
            return 'f'
        if re.search(r'\{\{n\}\}', header):
            return 'n'
        if re.search(r'\{\{Pl\.?\}\}', header):
            return 'pl'

    return None


def parse_worttrennung(wikitext: str) -> Optional[str]:
    """
    Extract word separation (Worttrennung) from Wiktionary
    Returns syllable-separated form like: dan·ken, Prät. dank·te, Part. ge·dankt
    """
    # Find the Worttrennung section using regex (simpler for section extraction)
    worttrennung_match = re.search(r'\{\{Worttrennung\}\}\s*\n:([^\n]+)', wikitext)
    if not worttrennung_match:
        return None

    worttrennung_raw = worttrennung_match.group(1).strip()

    # Parse with mwparserfromhell to expand templates
    try:
        wikicode = mwparserfromhell.parse(worttrennung_raw)

        # Expand all templates to their plain text
        for template in wikicode.filter_templates():
            template_name = str(template.name).strip()
            # Common abbreviations: Prät. (past tense), Part. (participle), Pl. (plural)
            # Komp. (comparative), Sup. (superlative)
            if template_name in ['Prät.', 'Part.', 'Pl.', 'Komp.', 'Sup.']:
                # Replace template with its name
                wikicode.replace(template, template_name)

        return str(wikicode).strip()
    except Exception:
        # Fallback to simple replacement if parsing fails
        worttrennung_raw = worttrennung_raw.replace('{{Prät.}}', 'Prät.')
        worttrennung_raw = worttrennung_raw.replace('{{Part.}}', 'Part.')
        worttrennung_raw = worttrennung_raw.replace('{{Pl.}}', 'Pl.')
        worttrennung_raw = worttrennung_raw.replace('{{Komp.}}', 'Komp.')
        worttrennung_raw = worttrennung_raw.replace('{{Sup.}}', 'Sup.')
        return worttrennung_raw if worttrennung_raw else None


def parse_bedeutungen_raw(wikitext: str) -> Optional[str]:
    """
    Extract and clean up the Bedeutungen (meanings) section
    Returns the raw meanings with cleaned wikitext using mwparserfromhell
    """
    # Find the Bedeutungen section - match until next section template or major heading
    # Stop at section templates (on new line), ==Heading==, or end of text
    # Use \n{{CapitalWord}} to avoid matching inline templates like {{K|...}}
    bedeutungen_match = re.search(r'\{\{Bedeutungen\}\}(.*?)(?:\n\{\{[A-Z][a-z]+|==|\Z)', wikitext, re.DOTALL)
    if not bedeutungen_match:
        return None

    meanings_section = bedeutungen_match.group(1).strip()

    try:
        # Parse with mwparserfromhell
        wikicode = mwparserfromhell.parse(meanings_section)

        # Process {{K|...}} templates - expand to parentheses
        for template in wikicode.filter_templates():
            template_name = str(template.name).strip()
            if template_name == 'K':
                # Get all parameters and join with commas
                params = [str(p.value).strip() for p in template.params]
                replacement = '(' + ', '.join(params) + ')'
                wikicode.replace(template, replacement)

        # Strip wiki links but keep text
        for wikilink in wikicode.filter_wikilinks():
            # Use display text if available, otherwise use target
            display_text = str(wikilink.text) if wikilink.text else str(wikilink.title)
            wikicode.replace(wikilink, display_text)

        # Remove italic markup
        cleaned = str(wikicode)
        cleaned = re.sub(r"''([^']+)''", r'\1', cleaned)

        # Remove <ref>...</ref> tags
        cleaned = re.sub(r'<ref[^>]*>.*?</ref>', '', cleaned, flags=re.DOTALL)

        # Clean up extra whitespace
        cleaned = re.sub(r'\n\s*\n', '\n', cleaned)
        cleaned = cleaned.strip()

        return cleaned if cleaned else None

    except Exception as e:
        # Fallback to regex-based cleanup if parsing fails
        print(f"Bedeutungen parsing error: {e}")
        cleaned = meanings_section
        cleaned = re.sub(r'\{\{K\|([^}]+)\}\}', lambda m: '(' + m.group(1).replace('|', ', ') + ')', cleaned)
        cleaned = re.sub(r'\[\[([^|\]]+)\|([^\]]+)\]\]', r'\2', cleaned)
        cleaned = re.sub(r'\[\[([^\]]+)\]\]', r'\1', cleaned)
        cleaned = re.sub(r"''([^']+)''", r'\1', cleaned)
        cleaned = re.sub(r'<ref[^>]*>.*?</ref>', '', cleaned, flags=re.DOTALL)
        cleaned = re.sub(r'\n\s*\n', '\n', cleaned).strip()
        return cleaned if cleaned else None


def parse_definition(wikitext: str) -> Optional[str]:
    """Extract first definition only (deprecated, use parse_bedeutungen_raw)"""
    bedeutungen_match = re.search(r'{{Bedeutungen}}(.*?)(?:{{|$)', wikitext, re.DOTALL)
    if not bedeutungen_match:
        return None

    meanings_section = bedeutungen_match.group(1)

    # Get first meaning
    first_meaning = re.search(r':\[1\]\s*([^\n]+)', meanings_section)
    if first_meaning:
        definition = first_meaning.group(1)
        # Clean up markup
        definition = re.sub(r'\[\[([^|\]]+)\|([^\]]+)\]\]', r'\2', definition)  # [[link|text]] → text
        definition = re.sub(r'\[\[([^\]]+)\]\]', r'\1', definition)  # [[text]] → text
        definition = re.sub(r"''([^']+)''", r'\1', definition)  # ''italic'' → italic

        return definition.strip()

    return None


def get_word_info(word: str) -> Dict:
    """
    Get comprehensive word information from Wiktionary

    Returns:
        {
            "word": str,
            "found": bool,
            "gender": str | None,  # 'm', 'f', 'n', 'pl', or None
            "cases": List[str],  # e.g. ["mit Dativ"]
            "definition": str,
            "examples": List[str],
            "note": str  # User-friendly explanation
        }
    """
    wikitext = fetch_wiktionary_wikitext(word)

    if not wikitext:
        return {
            "word": word,
            "found": False,
            "gender": None,
            "cases": [],
            "definition": None,
            "examples": [],
            "note": "Word not found in Wiktionary"
        }

    gender = parse_gender(wikitext)
    cases = parse_case_requirements(wikitext)
    definition = parse_definition(wikitext)
    bedeutungen_raw = parse_bedeutungen_raw(wikitext)  # Get raw meanings section
    worttrennung = parse_worttrennung(wikitext)  # Get syllable separation
    examples = parse_examples(wikitext)

    # Create user-friendly note for gender only
    note = None
    if gender:
        gender_map = {
            'm': '♂ Masculine (der)',
            'f': '♀ Feminine (die)',
            'n': '⚲ Neuter (das)',
            'pl': 'Plural only'
        }
        note = f"**Gender:** {gender_map.get(gender, gender)}"

    return {
        "word": word,
        "found": True,
        "gender": gender,
        "cases": cases,  # Deprecated - keeping for backward compatibility
        "definition": definition,  # Deprecated - use bedeutungen_raw instead
        "bedeutungen": bedeutungen_raw,  # Raw meanings section with all case info
        "worttrennung": worttrennung,  # Syllable separation
        "examples": examples,
        "note": note
    }
