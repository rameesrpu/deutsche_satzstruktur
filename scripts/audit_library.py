#!/usr/bin/env python3
"""
Audit pre-analyzed library data (data/library/*.json) for word metadata that
game mode cannot place correctly.

Usage:
    python3 scripts/audit_library.py            # audit all library files
    python3 scripts/audit_library.py FILE...    # audit specific files

Mirrors getWordPosition() in js/gridview.js. Reports:
  - subjects that fall back to the masculine cell (no pronoun cell, no gender/number)
  - objects/adjectives that fall back to the masculine cell (not plural, gender not
    m/f/n, not an object pronoun)
  - subjects/objects with missing case
  - duplicate word ids within a sentence (ids repeat across sentences in the
    library files; harmless, because bulkLoadLibraryCategory reassigns all ids)
  - sentences without words

Exits 1 if anything is found, 0 otherwise.
"""

import glob
import json
import os
import re
import sys

REPO_ROOT   = os.path.join(os.path.dirname(__file__), '..')
LIBRARY_DIR = os.path.join(REPO_ROOT, 'data', 'library')

PRONOUN_CELLS   = {'ich', 'du', 'wir', 'we', 'ihr', 'sie_pl'}
OBJECT_PRONOUNS = {'mich', 'dich', 'uns', 'euch', 'mir', 'dir'}
GENDERS         = {'m', 'f', 'n', 'neuter'}
CASES           = {'nom', 'akk', 'dat', 'gen'}
TRAILING_PUNCT  = re.compile(r'[.,!?;:]+$')


def has_gender_cell(word):
    return word.get('number') == 'pl' or word.get('gender') in GENDERS


def audit_word(word):
    """Return a list of problem descriptions for one word."""
    wtype = word.get('type', '')
    problems = []

    if wtype == 'subject':
        pronoun = ((word.get('conjugation') or {}).get('pronoun') or '').lower()
        if pronoun not in PRONOUN_CELLS and not has_gender_cell(word):
            problems.append('subject defaults to masculine (no gender/number)')

    is_object = 'object' in wtype
    if is_object or wtype == 'adjective':
        text = TRAILING_PUNCT.sub('', word.get('text', '').lower())
        if text not in OBJECT_PRONOUNS and not has_gender_cell(word):
            problems.append(f'{wtype} defaults to masculine (no gender/number)')

    if (wtype == 'subject' or is_object) and word.get('case') not in CASES:
        problems.append(f'{wtype} has missing case ({word.get("case")!r})')

    return problems


def audit_file(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    name = os.path.basename(path)
    findings = []

    for i, sentence in enumerate(data.get('sentences', [])):
        text = sentence.get('text', '')
        words = sentence.get('words')
        if not words:
            findings.append(f'{name} #{i} "{text}": sentence has no words')
            continue
        seen_ids = set()
        for word in words:
            wid = word.get('id')
            if wid in seen_ids:
                findings.append(f'{name} #{i} "{text}": duplicate word id {wid}')
            seen_ids.add(wid)
            for problem in audit_word(word):
                findings.append(f'{name} #{i} "{text}": "{word.get("text")}" — {problem}')

    return findings, len(data.get('sentences', [])), sum(len(s.get('words') or []) for s in data.get('sentences', []))


def main():
    paths = sys.argv[1:] or sorted(glob.glob(os.path.join(LIBRARY_DIR, '*.json')))
    all_findings = []
    n_sentences = n_words = 0

    for path in paths:
        findings, s, w = audit_file(path)
        all_findings.extend(findings)
        n_sentences += s
        n_words += w

    for finding in all_findings:
        print(finding)
    print(f'\nScanned {len(paths)} files, {n_sentences} sentences, {n_words} words: '
          f'{len(all_findings)} problem(s).')
    sys.exit(1 if all_findings else 0)


if __name__ == '__main__':
    main()
