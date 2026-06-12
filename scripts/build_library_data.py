#!/usr/bin/env python3
"""
Build pre-analyzed library data from a saved sentences export.

Usage:
    python3 scripts/build_library_data.py                          # uses latest saved file
    python3 scripts/build_library_data.py data/saved/my-file.json  # use specific file

Reads the saved sentences file (which includes manually corrected word data),
matches each sentence to its level JSON by text + level + category, and writes
the analyzed word data to data/library/<filename>.json (separate from the
source sentence lists in data/levels/).

Sentences not found in the saved file are written as { "text": "..." } with no
words array — the app falls back to the backend for those.
"""

import json
import os
import glob
import sys
from datetime import date

REPO_ROOT   = os.path.join(os.path.dirname(__file__), '..')
LEVELS_DIR  = os.path.join(REPO_ROOT, 'data', 'levels')
LIBRARY_DIR = os.path.join(REPO_ROOT, 'data', 'library')
SAVED_DIR   = os.path.join(REPO_ROOT, 'data', 'saved')


def find_latest_saved_file():
    files = glob.glob(os.path.join(SAVED_DIR, 'deutsch-sentences-*.json'))
    if not files:
        files = glob.glob(os.path.join(SAVED_DIR, '*.json'))
    return max(files) if files else None


def load_saved_index(filepath):
    """Index library sentences by (text, level, category) → words list."""
    with open(filepath, encoding='utf-8') as f:
        data = json.load(f)

    index = {}
    duplicates = 0
    for s in data['sentences']:
        if s.get('source') != 'library':
            continue
        key = (s['text'].strip(), s.get('level', '').strip(), s.get('category', '').strip())
        if key in index:
            duplicates += 1
        index[key] = s.get('words')

    if duplicates:
        print(f"  Warning: {duplicates} duplicate library sentence(s) in saved file (last wins)")
    return index


def category_key_from_filename(filepath):
    """A1_hauptsatz.json → ('A1', 'hauptsatz')"""
    name = os.path.basename(filepath).replace('.json', '')
    level, _, cat = name.partition('_')
    return level, cat


def process_level_file(filepath, saved_index, version):
    with open(filepath, encoding='utf-8') as f:
        data = json.load(f)

    level = data.get('level', '')
    _, cat = category_key_from_filename(filepath)

    matched, missing = 0, []
    sentences_out = []

    for entry in data['sentences']:
        text  = entry if isinstance(entry, str) else entry.get('text', '')
        key   = (text.strip(), level, cat)
        words = saved_index.get(key)

        if words:
            sentences_out.append({'text': text, 'words': words})
            matched += 1
        else:
            sentences_out.append({'text': text})
            missing.append(text)

    output = {
        'level':    level,
        'category': data.get('category', ''),
        'version':  version,
        'sentences': sentences_out,
    }

    out_path = os.path.join(LIBRARY_DIR, os.path.basename(filepath))
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return matched, missing


def main():
    saved_file = sys.argv[1] if len(sys.argv) > 1 else find_latest_saved_file()
    if not saved_file or not os.path.exists(saved_file):
        print("Error: no saved sentences file found. Pass the path as an argument.")
        sys.exit(1)

    os.makedirs(LIBRARY_DIR, exist_ok=True)

    print(f"Source: {saved_file}")
    saved_index = load_saved_index(saved_file)
    print(f"Indexed {len(saved_index)} library sentences\n")

    version     = str(date.today())
    level_files = sorted(glob.glob(os.path.join(LEVELS_DIR, '*.json')))
    total_sentences = total_matched = total_missing = 0
    all_missing = []

    for filepath in level_files:
        matched, missing = process_level_file(filepath, saved_index, version)
        n = matched + len(missing)
        total_sentences += n
        total_matched   += matched
        total_missing   += len(missing)
        tag = "✓" if not missing else "!"
        print(f"  [{tag}] {os.path.basename(filepath):45s} {matched}/{n}")
        for text in missing:
            all_missing.append((os.path.basename(filepath), text))

    print(f"\n{total_matched}/{total_sentences} sentences matched, {total_missing} missing")

    if all_missing:
        print("\nMissing (need backend analysis):")
        for filename, text in all_missing:
            print(f"  [{filename}] {text}")
    else:
        print("\nAll sentences have pre-analyzed data.")


if __name__ == '__main__':
    main()
