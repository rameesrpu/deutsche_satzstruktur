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

Glossary: each story file may have a "glossary" ({headword: {de, en, forms}}); all glossaries
of a level form one dictionary. Each chapter file gets the entries whose forms occur in its
beats (matching rules: glossary_matches, mirrored by js/glossary.js). Forms that occur in no
chapter of the level are reported as warnings (typos).

Images: an optional picture per chapter at data/stories/<level>/img/<name>.<ext> (webp/jpg/png/svg),
where name is the chapter's "image": {"place": "wg-kueche"} (one picture per place, shared by every
chapter set there) or else its chapter id; alt text from "image": {"alt": "..."}. The
chapter file gets "image": {"src": "<path>?v=<content hash>", "alt"}. Missing alt text, a
"image" entry without a file, files that match no chapter and files over IMAGE_MAX_KB warn
(.txt/.md notes, e.g. the image prompt, are ignored).

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
import re
import sys

REPO_ROOT   = os.path.join(os.path.dirname(__file__), '..')
STORIES_DIR = os.path.join(REPO_ROOT, 'data', 'stories')
LEVELS_DIR  = os.path.join(REPO_ROOT, 'data', 'levels')
LIBRARY_DIR = os.path.join(REPO_ROOT, 'data', 'library')
INDEX_JS    = os.path.join(REPO_ROOT, 'js', 'storyContent.js')

IMAGE_EXTS   = ('.webp', '.jpg', '.png', '.svg')
IMAGE_MAX_KB = 80
IMAGE_NOTES  = ('.txt', '.md')   # image prompts / notes next to the pictures

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


# --- Glossary matching (keep in sync with js/glossary.js glossTokens) ---

WORD_RE = re.compile(r'[^\W\d_]+(?:-[^\W\d_]+)*')
SENTENCE_END_RE = re.compile(r'[.!?:;]')
# A separable particle closes its clause: punctuation, end of text, or "… aus wie"
PARTICLE_END_RE = re.compile(r'\s*(?:[.,!?;:…“”"»«)]|$|wie\b)')
SEPARATOR = '…'


def form_variants(token):
    """A token matches a form exactly, or (sentence start) with its first letter lowercased."""
    if token[:1].isupper():
        return (token, token[0].lower() + token[1:])
    return (token,)


def glossary_matches(text, glossary):
    """
    → [(token, start, end, key, form)] for every word of `text`; key/form are None
    without a glossary entry. Separable forms ("geht … auf") match when the particle
    comes later in the same sentence and closes the clause; they win over single forms.
    """
    tokens = [(m.group(), m.start(), m.end()) for m in WORD_RE.finditer(text)]
    found = [None] * len(tokens)
    singles, separables = {}, []
    for key, entry in glossary.items():
        for form in entry['forms']:
            if SEPARATOR in form:
                first, particle = (p.strip() for p in form.split(SEPARATOR))
                separables.append((first, particle, key, form))
            else:
                singles[form] = key
    for i, (tok, _, end) in enumerate(tokens):
        if found[i]:
            continue
        for first, particle, key, form in separables:
            if first not in form_variants(tok):
                continue
            for j in range(i + 1, len(tokens)):
                if SENTENCE_END_RE.search(text[tokens[j - 1][2]:tokens[j][1]]):
                    break
                if (tokens[j][0] == particle and not found[j]
                        and PARTICLE_END_RE.match(text, tokens[j][2])):
                    found[i] = found[j] = (key, form)
                    break
            if found[i]:
                break
    for i, (tok, _, _) in enumerate(tokens):
        if not found[i]:
            for variant in form_variants(tok):
                if variant in singles:
                    found[i] = (singles[variant], variant)
                    break
    return [(tok, start, end, *(found[i] or (None, None)))
            for i, (tok, start, end) in enumerate(tokens)]


def check_glossary(glossary, where, errors):
    """Entry shape and one entry per form."""
    owner = {}
    for key, entry in glossary.items():
        if not (isinstance(entry.get('de'), str) and entry['de'] and
                isinstance(entry.get('en'), str) and entry['en'] and
                isinstance(entry.get('forms'), list) and entry['forms']):
            errors.append(f'{where}: glossary "{key}" needs de, en and forms')
            continue
        for form in entry['forms']:
            if form in owner:
                errors.append(f'{where}: glossary form "{form}" in both "{owner[form]}" and "{key}"')
            owner[form] = key


def unused_glossary_forms(glossary, texts):
    """Forms that occur in none of `texts` → [(key, form)]."""
    used = {(m[3], m[4]) for text in texts for m in glossary_matches(text, glossary) if m[3]}
    return [(key, form) for key, entry in glossary.items()
            for form in entry['forms'] if (key, form) not in used]


def chapter_glossary(beats, glossary):
    """The glossary entries used in a chapter's beats, in order of first use."""
    keys = []
    for beat in beats:
        for m in glossary_matches(beat.get('read') or beat.get('play') or '', glossary):
            if m[3] and m[3] not in keys:
                keys.append(m[3])
    return {key: glossary[key] for key in keys}


def content_version(sentences):
    blob = json.dumps(sentences, ensure_ascii=False, sort_keys=True).encode('utf-8')
    return hashlib.sha1(blob).hexdigest()[:10]


def chapter_images(level):
    """{name: file path} of the pictures in data/stories/<level>/img/ (first extension wins)."""
    found = {}
    for path in sorted(glob.glob(os.path.join(STORIES_DIR, level, 'img', '*'))):
        stem, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() in IMAGE_EXTS and stem not in found:
            found[stem] = path
    return found


def image_key(ch):
    """Picture name of a chapter: its "image" place (shared by chapters set there), else its id."""
    return (ch.get('image') or {}).get('place') or ch['id']


def stray_images(level, keys):
    """Files in data/stories/<level>/img/ that no chapter uses (typo, wrong extension, unused place)."""
    images = chapter_images(level)
    used = {images[k] for k in keys if k in images}
    return [os.path.basename(p) for p in sorted(glob.glob(os.path.join(STORIES_DIR, level, 'img', '*')))
            if p not in used and not p.endswith(IMAGE_NOTES)]


def chapter_image(level, ch, images, warnings):
    """The chapter file's image entry ({src, alt}) or None."""
    where = f'{level} {ch["id"]}'
    meta = ch.get('image') or {}
    key = image_key(ch)
    path = images.get(key)
    if not path:
        if meta:
            warnings.append(f'{where}: "image" given but no img/{key}.* file')
        return None
    with open(path, 'rb') as f:
        blob = f.read()
    if len(blob) > IMAGE_MAX_KB * 1024:
        warnings.append(f'{where}: image is {len(blob) // 1024} KB (max {IMAGE_MAX_KB} KB)')
    alt = (meta.get('alt') or '').strip()
    if not alt:
        warnings.append(f'{where}: image has no "alt" text (using the chapter title)')
        alt = ch['title']
    rel = os.path.relpath(path, REPO_ROOT).replace(os.sep, '/')
    return {'src': f'{rel}?v={hashlib.sha1(blob).hexdigest()[:10]}', 'alt': alt}


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
    stories = []
    for path in sorted(glob.glob(os.path.join(STORIES_DIR, '*', '*.json'))):
        with open(path, encoding='utf-8') as f:
            stories.append(json.load(f))

    # One glossary per level, from all of its story files
    glossaries = {}
    for story in stories:
        level_glossary = glossaries.setdefault(story['level'], {})
        for key, entry in story.get('glossary', {}).items():
            if key in level_glossary:
                errors.append(f'{story["level"]} story {story["story"]}: glossary "{key}" defined twice')
            level_glossary[key] = entry
    for level, glossary in glossaries.items():
        check_glossary(glossary, level, errors)
        texts = [b.get('read') or b.get('play') or '' for story in stories if story['level'] == level
                 for ch in story['chapters'] for b in ch['beats']]
        for key, form in unused_glossary_forms(glossary, texts):
            warnings.append(f'{level}: glossary form "{form}" ("{key}") never appears in a chapter')

    images = {level: chapter_images(level) for level in glossaries}
    for level in images:
        keys = [image_key(ch) for story in stories if story['level'] == level for ch in story['chapters']]
        for name in stray_images(level, keys):
            warnings.append(f'{level}: img/{name} is used by no chapter (expected <place or chapter id>{"|".join(IMAGE_EXTS)})')

    for story in stories:
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
            extra = {
                'story': story['story'], 'storyTitle': story['title'],
                'chapter': ch['id'], 'title': ch['title'], 'skill': ch['skill'], 'beats': beats,
                'glossary': chapter_glossary(beats, glossaries.get(level, {})),
            }
            image = chapter_image(level, ch, images.get(level, {}), warnings)
            if image:
                extra['image'] = image
            write_set(name, level, label, texts, library, extra)

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
