"""
Manual corrections to pre-analyzed library word data.

data/library/*.json is generated from a saved export by build_library_data.py;
these corrections are applied on top of it (by that script, and once directly
via `python3 scripts/library_corrections.py`), so they survive a rebuild.

Each correction matches a sentence by exact text in a library file and a word by
its exact text (first occurrence), then sets the given fields on that word.
Run scripts/audit_library.py afterwards to verify.
"""

import json
import os
import sys

REPO_ROOT   = os.path.join(os.path.dirname(__file__), '..')
LIBRARY_DIR = os.path.join(REPO_ROOT, 'data', 'library')

OTHER = {'type': 'other', 'gender': 'none', 'case': 'nom', 'number': 'sg'}

CORRECTIONS = [
    # Plural nouns tagged without number/gender
    ('A1_hauptsatz.json', 'Die Frau kauft Äpfel.', 'Äpfel.',
     {'type': 'object', 'gender': 'm', 'case': 'akk', 'number': 'pl'}),
    ('A1_zahlen_zeit.json', 'Ich kaufe zwei Kilo Äpfel.', 'zwei', {'case': 'akk'}),
    ('A1_zahlen_zeit.json', 'Ich kaufe zwei Kilo Äpfel.', 'Kilo', {'case': 'akk'}),
    ('A1_zahlen_zeit.json', 'Ich kaufe zwei Kilo Äpfel.', 'Äpfel.',
     {'type': 'object', 'gender': 'm', 'case': 'akk', 'number': 'pl'}),

    # Herbstmarkt story
    ('A1_story_der_herbstmarkt.json',
     'Das Wetter in Wien ist kühl und sonnig – typisch Herbst.', 'Herbst.', OTHER),
    ('A1_story_der_herbstmarkt.json',
     'Einen Moment, sagt Lena, ich hole meine Tasche.', 'Lena,',
     {'gender': 'f', 'number': 'sg', 'case': 'nom'}),
    # "sie" = Lena and Tommy
    ('A1_story_der_herbstmarkt.json',
     'Marco steht hinter der Theke – er sieht sie sofort.', 'sie',
     {'gender': 'none', 'case': 'akk', 'number': 'pl'}),
    ('A1_story_der_herbstmarkt.json',
     'Mmm – der ist wirklich sehr gut!, sagt sie.', 'Mmm', OTHER),
    ('A1_story_der_herbstmarkt.json',
     'Wie viel kostet ein Kilo Tomaten?, fragt Thomas.', 'viel', OTHER),

    # Objects tagged nom. Measure phrases → akk object; real nominatives → subject.
    *[('A1_story_der_herbstmarkt.json',
       'Der Naschmarkt ist zehn Minuten zu Fuß vom Café.', w,
       {'type': 'object', 'gender': 'f', 'case': 'akk', 'number': 'pl'})
      for w in ('zehn', 'Minuten')],
    *[('A1_story_der_herbstmarkt.json', 'Ich nehme zwei Kilo, sagt Thomas.', w,
       {'gender': 'n', 'case': 'akk', 'number': 'pl'})
      for w in ('zwei', 'Kilo,')],
    # Elliptic "(Ich möchte) drei rote Paprika"
    *[('A1_story_der_herbstmarkt.json', 'Drei rote Paprika, bitte, sagt Lena.', w,
       {'type': t, 'gender': 'f', 'case': 'akk', 'number': 'pl'})
      for w, t in (('Drei', 'object'), ('rote', 'adjective'), ('Paprika,', 'object'))],
    # The list continues the subjects "Auberginen, Käse"
    *[('A1_story_der_herbstmarkt.json',
       'Marco schaut in seine Tasche: Auberginen, Käse und zwei Äpfel – vielleicht ein bisschen viel.',
       w, {'type': 'subject', 'gender': 'm', 'case': 'nom', 'number': 'pl'})
      for w in ('zwei', 'Äpfel')],
    ('A1_story_der_herbstmarkt.json',
     'Marco schaut in seine Tasche: Auberginen, Käse und zwei Äpfel – vielleicht ein bisschen viel.',
     'viel.', OTHER),
    # "ein Kilo Tomaten" is the subject of "kostet"
    *[('A1_story_der_herbstmarkt.json', 'Wie viel kostet ein Kilo Tomaten?, fragt Thomas.', w,
       {'type': 'subject', 'gender': 'n', 'case': 'nom', 'number': 'sg'})
      for w in ('ein', 'Kilo', 'Tomaten?,')],
    # Predicative nominative
    ('A1_story_neue_nachbarn.json',
     'Das ist Wohnung 7c, sagt Thomas, aber Frau Hoffmann ist nicht zu Hause.', '7c,',
     {'type': 'subject', 'gender': 'f', 'case': 'nom', 'number': 'sg'}),
    # Elliptic "danach (kommt) noch die Facharztausbildung"
    *[('A1_story_neue_nachbarn.json',
       'Sechs Jahre, sagt Lena, und danach noch die Facharztausbildung.', w,
       {'type': 'subject', 'gender': 'f', 'case': 'nom', 'number': 'sg'})
      for w in ('die', 'Facharztausbildung.')],
    # "zwei Wochen" is the subject of "sind"
    ('A1_zahlen_zeit.json', 'Es sind noch zwei Wochen bis zum Urlaub.', 'zwei',
     {'type': 'subject', 'gender': 'f', 'case': 'nom', 'number': 'pl'}),

    # Quantifiers / adverbs → other
    ('A2_futur1.json', 'Ich werde mehr Sport treiben.', 'mehr', OTHER),
    ('A2_imperativ.json', 'Trink mehr Wasser!', 'mehr', OTHER),
    ('B1_infinitivkonstruktionen.json', 'Ich versuche, mehr Deutsch zu sprechen.', 'mehr', OTHER),
    ('A2_nebensatz.json', 'Sie arbeitet viel, obwohl sie krank ist.', 'viel,', OTHER),
    ('B1_temporalsaetze.json',
     'Seit ich in Deutschland lebe, spreche ich viel Deutsch.', 'viel', OTHER),
    ('B1_zweiteilige_konnektoren.json',
     'Zwar hat er wenig Zeit, aber er hilft uns trotzdem.', 'wenig', OTHER),

    # Reflexive "sich" → akk cell of the subject's gender
    ('A2_reflexivverben.json', 'Er verletzt sich beim Sport.', 'sich',
     {'gender': 'm', 'number': 'sg', 'case': 'akk'}),
    ('A2_reflexivverben.json', 'Er bewirbt sich um die Stelle.', 'sich',
     {'gender': 'm', 'number': 'sg', 'case': 'akk'}),
    ('B1_infinitivkonstruktionen.json', 'Sie freut sich, dich wiederzusehen.', 'sich,',
     {'gender': 'f', 'number': 'sg', 'case': 'akk'}),
]


def apply_corrections(filename, data):
    """Apply all corrections for `filename` to library `data` in place.
    Returns the number applied; raises if a correction no longer matches."""
    applied = 0
    for file, sentence_text, word_text, fields in CORRECTIONS:
        if file != filename:
            continue
        sentence = next((s for s in data['sentences'] if s.get('text') == sentence_text), None)
        word = next((w for w in (sentence or {}).get('words') or [] if w.get('text') == word_text), None)
        if word is None:
            raise ValueError(f'{file}: correction target not found: "{sentence_text}" / "{word_text}"')
        word.update(fields)
        applied += 1
    return applied


def main():
    """Apply corrections directly to data/library files, setting `version` to argv[1]."""
    if len(sys.argv) != 2:
        print('Usage: python3 scripts/library_corrections.py NEW_VERSION')
        sys.exit(1)
    version = sys.argv[1]
    for filename in sorted({c[0] for c in CORRECTIONS}):
        path = os.path.join(LIBRARY_DIR, filename)
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        n = apply_corrections(filename, data)
        data['version'] = version
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'  {filename}: {n} correction(s), version {version}')


if __name__ == '__main__':
    main()
