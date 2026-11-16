#!/usr/bin/env python3
"""
Check story chapters for what build_stories.py does not: size, grammar coverage, skill ladder,
glossary coverage, content words and the boss sentence (rules: docs/superpowers/specs/
2026-11-16-content-pipeline-design.md, "Chapter checker").

Usage:
    python3 scripts/check_story.py [story.json ...]     (default: every data/stories/*/*.json)

Prints "ERROR <file> <chapter id>: <message>" / "WARN ..." lines, then "N errors, M warnings".
Exit 1 if there is any error. The chapters before the checked one (story order, lower levels
first) give the context: known words, repeated play texts, new glossary words.
"""

import glob
import json
import os
import re
import sys

import build_stories as bs
from build_stories import WORD_RE, SENTENCE_END_RE, STORIES_DIR, glossary_matches

PLAY_MIN, PLAY_MAX = 12, 15
DRILL_MIN, DRILL_MAX = 8, 10
MIN_PERSONS = 4
MAX_NEW_GLOSSARY = 12

LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
GENDERS = ('m', 'f', 'n', 'pl')
PERSON_KEYS = {'ich', 'du', 'wir', 'ihr', 'Sie'}
VERB_PERSON_MAP = {'er': '3sg', 'sie': '3sg', 'es': '3sg'}   # sie_pl, Sie count separately
# Alcohol, pork, physical romance (lower-case stems; also matched with a plain inflection ending)
BLOCKLIST = {'bier', 'wein', 'sekt', 'schnaps', 'whisky', 'wodka', 'cocktail', 'betrunken',
             'schwein', 'schinken', 'speck', 'salami', 'kuss', 'küssen', 'küsst', 'umarmen', 'umarmt'}
BLOCK_ENDINGS = {'e', 'en', 'n', 's', 'es', 'er', 't', 'st', 'te'}

CURRICULUM_PATH = os.path.join(STORIES_DIR, 'CURRICULUM.md')
WORDLIST_DIR = os.path.join(bs.REPO_ROOT, 'data', 'wordlists')


def load_skills(curriculum_path=CURRICULUM_PATH):
    """Skill ids in table order (A1.nom first); a skill's index is its rank."""
    skills = []
    with open(curriculum_path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'\|\s*([ABC][12]\.[a-z0-9_]+)\s*\|', line)
            if m and m.group(1) not in skills:
                skills.append(m.group(1))
    return skills


def texts_of(chapter):
    """Every beat and drill text of a chapter (read or play)."""
    return [item.get('read') or item.get('play') or '' for item in chapter['beats'] + chapter['drill']]


def tokens_of(text):
    """[(token, sentence_initial)] — a sentence starts at the text start and after . ! ? : ;"""
    out, prev_end = [], None
    for m in WORD_RE.finditer(text):
        initial = prev_end is None or bool(SENTENCE_END_RE.search(text[prev_end:m.start()]))
        out.append((m.group(), initial))
        prev_end = m.end()
    return out


def chapter_words(chapter):
    """Word tokens of all beats and the drill; a capitalised sentence start is also added in lower case."""
    words = set()
    for text in texts_of(chapter):
        for tok, initial in tokens_of(text):
            words.add(tok)
            if initial:
                words.add(tok[0].lower() + tok[1:])
    return words


def lower_words(chapter):
    """Tokens that occur in lower case in the chapter (a capital sentence start does not count)."""
    return {tok for text in texts_of(chapter) for tok, _ in tokens_of(text) if tok[:1].islower()}


def tag_kinds(items):
    """Genders, persons and the set of tag strings used by the play items (beats and drill)."""
    genders, persons, tags = set(), set(), set()
    for item in items:
        for tag in item.get('tags', '').split():
            tags.add(tag)
            parts = tag.split('.')
            if parts[0] in ('S', 'O') and len(parts) >= 2:
                if parts[1] in GENDERS:
                    genders.add(parts[1])
                if parts[1] in PERSON_KEYS:
                    persons.add(parts[1])
            elif parts[0] in ('V', 'M') and len(parts) == 2:
                persons.add(VERB_PERSON_MAP.get(parts[1], parts[1]))
    return genders, persons, tags


def blocked(token):
    low = token.lower()
    return any(low == stem or (low.startswith(stem) and low[len(stem):] in BLOCK_ENDINGS)
               for stem in BLOCKLIST)


def check_chapter(level, chapter, known_words, glossary, skills, wordlist=None,
                  earlier_plays=None, earlier_glossary=None, level_lower=None):
    """
    → (errors, warnings). known_words: words of all earlier chapters (chapter_words). glossary: the
    level's (and lower levels') entries. Context for the rules that look across chapters:
    earlier_plays (play texts of earlier chapters), earlier_glossary (keys they used),
    level_lower (lower-case tokens anywhere in the level; names are capitalised words not in it).
    """
    errors, warnings = [], []
    beats, drill = chapter['beats'], chapter['drill']
    plays = [b for b in beats if 'play' in b]
    items = plays + [d for d in drill if 'play' in d]

    if not PLAY_MIN <= len(plays) <= PLAY_MAX:
        errors.append(f'{len(plays)} play beats ({PLAY_MIN}–{PLAY_MAX} play beats expected)')
    if not DRILL_MIN <= len(drill) <= DRILL_MAX:
        errors.append(f'drill has {len(drill)} items ({DRILL_MIN}–{DRILL_MAX} expected)')

    genders, persons, tags = tag_kinds(items)
    missing = [g for g in GENDERS if g not in genders]
    # The shipped A1 chapters predate these two rules (several lack plural or a 4th person): warnings there
    soft = warnings if level == 'A1' else errors
    if missing:
        soft.append('gender missing: ' + ', '.join(missing) + ' (every chapter uses m, f, n and pl)')
    if len(persons) < MIN_PERSONS:
        soft.append(f'only {len(persons)} pronoun persons ({", ".join(sorted(persons)) or "none"}); '
                      f'at least {MIN_PERSONS} needed')

    skill = chapter.get('skill')
    if skill not in skills:
        errors.append(f'skill "{skill}" is not in the CURRICULUM.md tables')
    else:
        rank = skills.index(skill)
        if any(t.endswith('.gen') and t.startswith('O.') for t in tags) and rank < skills.index('B1.genitiv'):
            errors.append(f'gen object before B1.genitiv (skill {skill})')
        if any(t.endswith('.dat') and t.startswith('O.') for t in tags) and rank < skills.index('A1.dativ_praep'):
            warnings.append(f'dat object before A1.dativ_praep (skill {skill}); fine only for the documented exceptions')
        if 'C' in tags and rank < skills.index('A2.nebensatz'):
            errors.append(f'subordinate clause (C tag) before A2.nebensatz (skill {skill})')

    # Words: unglossed (and not on the word list)
    own_lower = lower_words(chapter) | (level_lower if level_lower is not None
                                        else {w for w in known_words if w[:1].islower()})
    unglossed, off_list = [], []
    seen = set()
    for text in texts_of(chapter):
        initials = {}
        for tok, initial in tokens_of(text):
            initials.setdefault(tok, initial)
        for tok, _, _, key, _ in glossary_matches(text, glossary):
            if key or tok in seen:
                continue
            seen.add(tok)
            initial = initials[tok]
            low = tok[0].lower() + tok[1:]
            if tok[:1].isupper() and low not in own_lower:
                continue    # a name or place: capitalised, never seen in lower case
            shown = low if initial and low in own_lower else tok   # "Ein" at a sentence start = "ein"
            if tok not in known_words and not (initial and low in known_words):
                if shown not in unglossed:
                    unglossed.append(shown)
            if wordlist is not None and low.lower() not in wordlist and shown not in off_list:
                off_list.append(shown)
    if unglossed:
        warnings.append('ungeglosst: ' + ', '.join(unglossed))
    if off_list:
        warnings.append('not on the word list: ' + ', '.join(off_list))

    used = {m[3] for b in beats for m in glossary_matches(b.get('read') or b.get('play') or '', glossary) if m[3]}
    new = used - (earlier_glossary or set())
    if len(new) > MAX_NEW_GLOSSARY:
        warnings.append(f'{len(new)} new glossary words (more than {MAX_NEW_GLOSSARY})')

    missing_en = [i['play'] for i in items if not (isinstance(i.get('en'), str) and i['en'].strip())]
    if missing_en:
        msg = f'{len(missing_en)} play beats/drill items have no en translation, e.g. "{missing_en[0]}"'
        (warnings if level == 'A1' else errors).append(msg)

    for item in beats + drill:
        text = item.get('read') or item.get('play') or ''
        hits = [tok for tok, _ in tokens_of(text) if blocked(tok)]
        if hits:
            warnings.append(f'content word {", ".join(hits)} in beat: {text}')

    if plays:
        lengths = [len(b['play'].split()) for b in plays]
        if sum(1 for n in lengths if n > lengths[-1]) >= 3:
            warnings.append(f'boss: the last play beat is not among the three longest: {plays[-1]["play"]}')

    for b in plays:
        if b['play'].strip() in (earlier_plays or ()):
            warnings.append(f'play text appears in an earlier chapter: {b["play"]}')
    return errors, warnings


# --- Command line ---

def level_rank(level):
    return LEVEL_ORDER.index(level) if level in LEVEL_ORDER else len(LEVEL_ORDER)


def load_wordlist(level):
    """Lower-case words of data/wordlists/<level>.txt and the lower levels; None without this level's file."""
    if not os.path.exists(os.path.join(WORDLIST_DIR, f'{level}.txt')):
        return None
    words = set()
    for lv in LEVEL_ORDER[:level_rank(level) + 1]:
        path = os.path.join(WORDLIST_DIR, f'{lv}.txt')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                words |= {line.strip().lower() for line in f if line.strip()}
    return words


def check_files(paths):
    """Check the chapters of `paths` (in context of every story file) → (lines, error count, warning count)."""
    wanted = {os.path.abspath(p) for p in paths}
    files = sorted({os.path.abspath(p) for p in glob.glob(os.path.join(STORIES_DIR, '*', '*.json'))} | wanted)
    stories = []
    for path in files:
        with open(path, encoding='utf-8') as f:
            stories.append((path, json.load(f)))
    stories.sort(key=lambda ps: (level_rank(ps[1]['level']), ps[0]))
    skills = load_skills()

    level_glossary, level_lowers = {}, {}
    for _, story in stories:
        level_glossary.setdefault(story['level'], {}).update(story.get('glossary', {}))
        low = level_lowers.setdefault(story['level'], set())
        for ch in story['chapters']:
            low |= lower_words(ch)

    lines, n_err, n_warn = [], 0, 0
    known, earlier_plays, earlier_glossary = set(), set(), set()
    for path, story in stories:
        level = story['level']
        glossary = {}
        for lv, entries in level_glossary.items():
            if level_rank(lv) <= level_rank(level):
                glossary.update(entries)
        lower = set().union(*(level_lowers[lv] for lv in level_lowers if level_rank(lv) <= level_rank(level)))
        for ch in story['chapters']:
            if not paths or path in wanted:
                errors, warnings = check_chapter(
                    level, ch, known, glossary, skills, wordlist=load_wordlist(level),
                    earlier_plays=earlier_plays, earlier_glossary=earlier_glossary, level_lower=lower)
                rel = os.path.relpath(path, bs.REPO_ROOT)
                lines += [f'ERROR {rel} {ch["id"]}: {e}' for e in errors]
                lines += [f'WARN {rel} {ch["id"]}: {w}' for w in warnings]
                n_err += len(errors)
                n_warn += len(warnings)
            known |= chapter_words(ch)
            earlier_plays |= {b['play'].strip() for b in ch['beats'] if 'play' in b}
            earlier_glossary |= {m[3] for b in ch['beats']
                                 for m in glossary_matches(b.get('read') or b.get('play') or '', glossary) if m[3]}
    return lines, n_err, n_warn


def main(argv):
    lines, n_err, n_warn = check_files(argv)
    for line in lines:
        print(line)
    print(f'{n_err} errors, {n_warn} warnings')
    return 1 if n_err else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
