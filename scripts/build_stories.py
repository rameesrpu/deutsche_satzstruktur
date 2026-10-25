#!/usr/bin/env python3
"""
Build playable story chapters from the hand-tagged story sources.

Usage:
    python3 scripts/build_stories.py

Reads data/stories/<level>/*.json (format: data/stories/CURRICULUM.md) and writes,
per chapter and per drill:
  - data/levels/<level>_g<story>k<chapter>[_uebung].json   sentence list (+ beats for chapters)
  - data/library/<same name>.json                          pre-tagged words for game mode
and js/storyContent.js (the chapter index used by levelContent.js / the level selector).

Library `version` is a hash of the file's words, so it changes exactly when the
content changes (browsers then reload the words, see bulkLoadLibraryCategory).

Tags: one per whitespace-separated word of a play sentence; "/" starts the next clause.
  S.<p>        subject      p: m f n pl ich du wir ihr Sie
  O.<p>.<case> object       p as above, case: nom akk dat gen
  V.<p> / M.<p> finite verb / modal agreeing with p: ich du er sie es wir ihr sie_pl
  V            non-finite verb (infinitive, participle, imperative)
  P preposition or separable particle, X other, K coordinating conj., C subordinating conj.
"""

import glob
import hashlib
import json
import os
import sys

REPO_ROOT   = os.path.join(os.path.dirname(__file__), '..')
STORIES_DIR = os.path.join(REPO_ROOT, 'data', 'stories')
LEVELS_DIR  = os.path.join(REPO_ROOT, 'data', 'levels')
LIBRARY_DIR = os.path.join(REPO_ROOT, 'data', 'library')
INDEX_JS    = os.path.join(REPO_ROOT, 'js', 'storyContent.js')

MAX_WORDS = {'A1': 10, 'A2': 12, 'B1': 16}
CASES     = {'nom', 'akk', 'dat', 'gen'}
VERB_PERSONS = {'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie_pl'}

# Person/gender part of S/O tags → (gender, number, conjugation pronoun)
NOUN_PERSONS = {
    'm':   ('m', 'sg', 'er'),
    'f':   ('f', 'sg', 'sie'),
    'n':   ('n', 'sg', 'es'),
    'pl':  ('none', 'pl', 'sie_pl'),
    'ich': ('none', 'sg', 'ich'),
    'du':  ('none', 'sg', 'du'),
    'wir': ('none', 'pl', 'wir'),
    'ihr': ('none', 'pl', 'ihr'),
    'Sie': ('none', 'pl', 'sie_pl'),
}
SIMPLE_TYPES = {'P': 'preposition', 'X': 'other', 'K': 'coord-conjunction', 'C': 'conjunction'}
# Object nouns take no conjugation pronoun; object pronouns keep theirs
PRONOUN_KEYS = {'ich', 'du', 'wir', 'ihr', 'Sie'}


class TagError(Exception):
    pass


def make_word(text, tag, index, clause_id):
    word = {
        'id': index + 1, 'type': 'other', 'text': text,
        'x': 160 + 80 * index, 'y': 160,
        'gender': 'none', 'case': 'nom', 'number': 'sg',
        'flowDirection': 'right',
        'conjugation': {'pronoun': 'none'},
        'clause_type': 'main', 'clause_id': clause_id,
    }
    parts = tag.split('.')
    kind = parts[0]
    if kind in SIMPLE_TYPES and len(parts) == 1:
        word['type'] = SIMPLE_TYPES[kind]
    elif kind == 'V' and len(parts) == 1:
        word['type'] = 'verb'
    elif kind in ('V', 'M') and len(parts) == 2 and parts[1] in VERB_PERSONS:
        word['type'] = 'verb' if kind == 'V' else 'modal'
        word['conjugation']['pronoun'] = parts[1]
    elif kind == 'S' and len(parts) == 2 and parts[1] in NOUN_PERSONS:
        gender, number, pronoun = NOUN_PERSONS[parts[1]]
        word.update(type='subject', gender=gender, number=number)
        word['conjugation']['pronoun'] = pronoun
    elif kind == 'O' and len(parts) == 3 and parts[1] in NOUN_PERSONS and parts[2] in CASES:
        gender, number, pronoun = NOUN_PERSONS[parts[1]]
        word.update(type='object', gender=gender, number=number, case=parts[2])
        if parts[1] in PRONOUN_KEYS:
            word['conjugation']['pronoun'] = pronoun
    else:
        raise TagError(f'bad tag "{tag}" on "{text}"')
    return word


def tag_sentence(text, tags):
    tokens = text.split()
    tag_list = tags.split()
    clause_id = 0
    words = []
    for tag in tag_list:
        if tag == '/':
            clause_id += 1
            continue
        if len(words) >= len(tokens):
            raise TagError(f'more tags than words in "{text}"')
        words.append(make_word(tokens[len(words)], tag, len(words), clause_id))
    if len(words) != len(tokens):
        raise TagError(f'{len(tokens)} words but {len(words)} tags in "{text}"')
    return words


def check_play(level, text, words, warnings, where):
    """Content rules from CURRICULUM.md (warnings, not errors)."""
    if len(words) > MAX_WORDS.get(level, 16):
        warnings.append(f'{where}: {len(words)} words (max {MAX_WORDS[level]}): {text}')
    if '–' in text or '—' in text:
        warnings.append(f'{where}: dash in play sentence: {text}')
    if any(w['text'].strip('.,!?').lower() in ('sagt', 'fragt') for w in words):
        warnings.append(f'{where}: speech tag in play sentence: {text}')
    if not any(w['type'] in ('subject', 'object') or w['conjugation']['pronoun'] != 'none'
               for w in words):
        warnings.append(f'{where}: nothing to place: {text}')


def content_version(sentences):
    blob = json.dumps(sentences, ensure_ascii=False, sort_keys=True).encode('utf-8')
    return hashlib.sha1(blob).hexdigest()[:10]


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def build_sentence_set(level, items, where, warnings, errors):
    """items: beats/drill entries → (texts, library sentences)."""
    texts, library = [], []
    for item in items:
        if 'play' not in item:
            continue
        text = item['play'].strip()
        try:
            words = tag_sentence(text, item.get('tags', ''))
        except TagError as e:
            errors.append(f'{where}: {e}')
            continue
        if text in texts:
            errors.append(f'{where}: duplicate play sentence: {text}')
            continue
        check_play(level, text, words, warnings, where)
        texts.append(text)
        library.append({'text': text, 'words': words})
    return texts, library


def write_set(name, level, category, texts, library, extra=None):
    level_data = {'level': level, 'category': category, **(extra or {}), 'sentences': texts}
    write_json(os.path.join(LEVELS_DIR, f'{name}.json'), level_data)
    write_json(os.path.join(LIBRARY_DIR, f'{name}.json'), {
        'level': level, 'category': category,
        'version': content_version(library), 'sentences': library,
    })


def build():
    warnings, errors = [], []
    index = {}
    for path in sorted(glob.glob(os.path.join(STORIES_DIR, '*', '*.json'))):
        with open(path, encoding='utf-8') as f:
            story = json.load(f)
        level = story['level']
        chapters_out = []
        for ch in story['chapters']:
            story_no, chapter_no = ch['id'].split('.')
            key = f'g{story_no}k{chapter_no}'
            name = f'{level}_{key}'
            label = f'{ch["id"]} {ch["title"]}'
            drill_label = f'{ch["id"]} Übung: {ch["drillTitle"]}'

            texts, library = build_sentence_set(level, ch['beats'], name, warnings, errors)
            beats = [{k: b[k] for k in ('speaker', 'read', 'play') if k in b} for b in ch['beats']]
            write_set(name, level, label, texts, library, {
                'story': story['story'], 'storyTitle': story['title'],
                'chapter': ch['id'], 'title': ch['title'], 'skill': ch['skill'], 'beats': beats,
            })

            drill_texts, drill_library = build_sentence_set(level, ch['drill'], f'{name}_uebung', warnings, errors)
            write_set(f'{name}_uebung', level, drill_label, drill_texts, drill_library, {
                'chapter': ch['id'], 'skill': ch['skill'],
            })

            chapters_out.append({
                'id': ch['id'], 'key': key, 'label': label,
                'file': f'data/levels/{name}.json',
                'drillKey': f'{key}_uebung', 'drillLabel': drill_label,
                'drillFile': f'data/levels/{name}_uebung.json',
            })
            print(f'  {name}: {len(texts)} play + {len(drill_texts)} drill sentences')
        index.setdefault(level, []).append({
            'story': story['story'], 'title': story['title'], 'chapters': chapters_out,
        })

    with open(INDEX_JS, 'w', encoding='utf-8') as f:
        f.write('// GENERATED by scripts/build_stories.py from data/stories/ — do not edit.\n')
        f.write('// Story chapters per level, in unlock order; see levelContent.js.\n')
        f.write('export const STORY_CONTENT = ')
        f.write(json.dumps(index, ensure_ascii=False, indent=4))
        f.write(';\n')

    for w in warnings:
        print('  warning:', w)
    for e in errors:
        print('  ERROR:', e)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(build())
