#!/usr/bin/env python3
"""
Write a review sheet (Markdown) per story chapter: what the owner reads to approve a chapter
(spec: docs/superpowers/specs/2026-11-16-content-pipeline-design.md, "Review sheet").

Usage:
    python3 scripts/story_review.py <story.json> [chapter id]

Writes out/review/<level>_<chapter id>.md (out/ is git-ignored) and prints each path.
The checker's errors and warnings come from check_story.py, in the context of all story files.
"""

import os
import sys

import build_stories as bs
import check_story as cs

REVIEW_DIR = os.path.join(bs.REPO_ROOT, 'out', 'review')


def item_line(item):
    """One beat or drill item: play text in bold with its translation, read text plain."""
    speaker = f'**{item["speaker"]}:** ' if item.get('speaker') else ''
    if 'play' in item:
        line = f'{speaker}**{item["play"]}**'
        en = item.get('en')
        if isinstance(en, str) and en.strip():
            line += f' — *{en.strip()}*'
        return line
    return f'{speaker}{item.get("read", "")}'


def review_sheet(level, story, chapter, errors, warnings, new_keys=None):
    """
    Markdown sheet of one chapter. new_keys: glossary keys first used in this chapter
    (checked_chapters gives them); None lists every entry the chapter uses.
    """
    glossary = story.get('glossary', {})
    if new_keys is None:
        new_keys = cs.glossary_keys(chapter, glossary)
    place = (chapter.get('image') or {}).get('place') or '–'
    lines = [f'# {level} {chapter["id"]} {chapter["title"]}', '',
             f'Skill: {chapter.get("skill", "–")} · Ort: {place}', '',
             '## Geschichte', '']
    lines += ['- ' + item_line(b) for b in chapter['beats']]
    title = chapter.get('drillTitle')
    lines += ['', '## Übung' + (f' – {title}' if title else ''), '']
    lines += ['- ' + item_line(d) for d in chapter['drill']]
    lines += ['', '## Neue Wörter', '']
    entries = [glossary[k] for k in sorted(new_keys, key=str.lower) if k in glossary]   # by word, not article
    lines += [f'- {e["de"]} — {e["en"]}' for e in entries] or ['Keine.']
    lines += ['', '## Prüfung', '']
    findings = [f'- Fehler: {e}' for e in errors] + [f'- Hinweis: {w}' for w in warnings]
    lines += findings or ['Keine Hinweise.']
    return '\n'.join(lines) + '\n'


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    path, wanted = argv[0], (argv[1] if len(argv) > 1 else None)
    written = 0
    os.makedirs(REVIEW_DIR, exist_ok=True)
    for _, story, ch, errors, warnings, new_keys in cs.checked_chapters([path]):
        if wanted and ch['id'] != wanted:
            continue
        out = os.path.join(REVIEW_DIR, f'{story["level"]}_{ch["id"]}.md')
        with open(out, 'w', encoding='utf-8') as f:
            f.write(review_sheet(story['level'], story, ch, errors, warnings, new_keys))
        print(out)
        written += 1
    if not written:
        print(f'no chapter {wanted} in {path}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
