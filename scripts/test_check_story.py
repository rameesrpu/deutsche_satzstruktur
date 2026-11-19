"""Tests for scripts/check_story.py. Run: python3 -m unittest scripts/test_check_story.py"""

import glob
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import check_story as cs
import story_review as sr
import build_stories as bs

CURRICULUM = os.path.join(bs.STORIES_DIR, 'CURRICULUM.md')
SKILLS = cs.load_skills(CURRICULUM)

TEXTS = ['Er geht heim', 'Sie kommt an', 'Es regnet viel', 'Wir sind da', 'Ihr wartet hier', 'Du bist müde',
         'Ich bin froh', 'Das Kind lacht', 'Die Koffer sind schwer', 'Der Zug fährt ab', 'Die Tür geht auf',
         'Das Wetter ist kalt', 'Der Bus kommt heute', 'Der Tag ist lang', 'Die Stadt ist sehr groß']
DRILL_TAGS = ['S.m V.er', 'S.f V.sie', 'S.n V.es', 'S.pl V.sie_pl', 'S.ich V.ich', 'S.du V.du', 'S.wir V.wir',
              'S.ihr V.ihr', 'S.Sie V.sie_pl', 'S.m V.er']


def chapter(n_play=12, n_drill=8, skill='A1.nom', play_tags='S.m V.er', last=None, extra=None, en=True):
    beats = [{'read': 'Ein Morgen.'}]
    for i in range(n_play):
        beat = {'play': TEXTS[i], 'tags': play_tags}
        if en:
            beat['en'] = 'x'
        beats.append(beat)
    if last:
        beats[-1]['play'] = last
    drill = [{'play': f'Satz {chr(97 + i)}', 'tags': DRILL_TAGS[i % len(DRILL_TAGS)]}
             for i in range(n_drill)]
    if en:
        for item in drill:
            item['en'] = 'x'
    if extra:
        beats.append(extra)
    return {'id': '1.1', 'title': 'T', 'skill': skill, 'drillTitle': 'D', 'beats': beats, 'drill': drill}


def gloss(forms):
    """A glossary with one entry per form (key = form)."""
    return {f: {'de': f, 'en': 'x', 'forms': [f]} for f in forms}


def run(ch, level='A1', glossary=None, **kw):
    return cs.check_chapter(level, ch, glossary or {}, SKILLS, **kw)


class CheckChapterTest(unittest.TestCase):
    def test_clean_chapter(self):
        errors, warnings = run(chapter())
        self.assertEqual(errors, [])

    def test_play_beat_count(self):
        self.assertTrue(any('12–15 play beats' in e for e in run(chapter(n_play=11))[0]))
        self.assertFalse(any('play beats' in e for e in run(chapter(n_play=12))[0]))
        self.assertTrue(any('12–15 play beats' in e for e in run(chapter(n_play=15, extra={'play': 'Noch eins', 'tags': 'S.m V.er'}))[0]))

    def test_drill_count(self):
        self.assertTrue(any('drill' in e for e in run(chapter(n_drill=7))[0]))
        self.assertFalse(any('drill' in e for e in run(chapter(n_drill=8))[0]))
        self.assertTrue(any('drill' in e for e in run(chapter(n_drill=11))[0]))

    def test_genders_missing(self):
        ch = chapter()
        ch['drill'] = [{'play': 'A', 'tags': 'S.m V.er'}, {'play': 'B', 'tags': 'S.f V.sie'}] * 4
        errors, _ = run(ch, level='A2')
        msg = [e for e in errors if 'gender' in e]
        self.assertEqual(len(msg), 1)
        self.assertIn('n', msg[0].split('missing')[1])
        self.assertIn('pl', msg[0].split('missing')[1])
        errors, warnings = run(ch, level='A1')
        self.assertFalse(any('gender' in e for e in errors))
        self.assertTrue(any('gender' in w for w in warnings))

    def test_persons(self):
        def with_persons(tags):
            ch = chapter(play_tags='V.er')
            ch['drill'] = [{'play': 'A', 'tags': t} for t in tags] * 2
            return ch
        base = ['S.m V.ich', 'S.f V.du', 'S.n V.er', 'S.pl V.er']
        self.assertTrue(any('persons' in e for e in run(with_persons(base), level='A2')[0]))
        self.assertFalse(any('persons' in e for e in run(with_persons(base + ['S.wir V.wir']), level='A2')[0]))

    def test_unknown_skill(self):
        self.assertTrue(any('A1.unknown' in e for e in run(chapter(skill='A1.unknown'))[0]))

    def test_genitive(self):
        ch = chapter(extra={'play': 'Das Auto des Mannes', 'tags': 'S.n S.n O.m.gen O.m.gen'})
        self.assertTrue(any('gen' in e for e in run(ch)[0]))
        ch['skill'] = 'B1.genitiv'
        self.assertFalse(any('gen' in e for e in run(ch)[0]))

    def test_subordinate_clause(self):
        extra = {'play': 'Er geht weil er müde ist', 'tags': 'S.m V.er / C S.m X V.er'}
        self.assertTrue(any('subordinate' in e for e in run(chapter(skill='A1.modal', extra=extra))[0]))
        self.assertFalse(any('subordinate' in e for e in run(chapter(skill='A2.nebensatz', extra=extra))[0]))

    def test_dative_is_a_warning(self):
        ch = chapter(skill='A1.akk', extra={'play': 'Er hilft der Frau', 'tags': 'S.m V.er O.f.dat O.f.dat'})
        errors, warnings = run(ch)
        self.assertFalse(any('dat' in e for e in errors))
        self.assertTrue(any('dat' in w for w in warnings))
        ch['skill'] = 'A1.dativ_praep'
        self.assertFalse(any('dat' in w for w in run(ch)[1]))

    def test_unglossed_exact_list(self):
        ch = chapter(n_play=12)
        ch['beats'] = [{'play': 'Ayisha kauft heute einen Schrank.', 'tags': 'S.f V.sie X X O.m.akk', 'en': 'x'}]
        glossary = {'schrank': {'de': 'x', 'en': 'wardrobe', 'forms': ['Schrank']}, **gloss(['kauft', 'einen'])}
        ch['drill'] = []
        _, warnings = run(ch, glossary=glossary, names={'Ayisha'})
        line = [w for w in warnings if 'ungeglosst' in w][0]
        self.assertEqual(line.split(':', 1)[1].strip(), 'heute')

    def _unglossed(self, text, glossed, names=frozenset()):
        ch = chapter()
        ch['beats'] = [{'play': text, 'tags': 'X', 'en': 'x'}]
        ch['drill'] = []
        _, warnings = run(ch, glossary=gloss(glossed), names=set(names))
        lines = [w for w in warnings if 'ungeglosst' in w]
        return lines[0].split(':', 1)[1] if lines else ''

    def test_sentence_initial_capital_is_the_same_word(self):
        self.assertNotIn('Heute', self._unglossed('Heute kommt Faris.', {'heute', 'kommt'}))

    def test_a_capital_inside_a_sentence_follows_the_matcher(self):
        # The matcher also tries a capitalised word in lower case (formal "Ihr" = the "ihr" entry):
        # the word can be tapped, so it is not unglossed; a noun with no form at all is
        self.assertEqual(self._unglossed('Hier, Ihr Ticket.', {'hier', 'ihr', 'Ticket'}).strip(), '')
        self.assertIn('Essen', self._unglossed('Das Essen ist gut.', {'das', 'ist', 'gut'}))

    def test_unknown_nouns_are_listed(self):
        out = self._unglossed('Er kauft einen Kühlschrank heute.', {'er', 'kauft', 'einen'})
        self.assertEqual(sorted(out.replace(',', ' ').split()), ['Kühlschrank', 'heute'])
        self.assertIn('Kühlschrank', self._unglossed('Kühlschrank ist neu.', {'ist', 'neu'}))

    def test_names_come_from_the_names_list(self):
        self.assertEqual(self._unglossed('Faris wohnt in Stuttgart.', {'wohnt', 'in'}, names={'Faris', 'Stuttgart'}).strip(), '')
        self.assertIn('Faris', self._unglossed('Faris wohnt in Stuttgart.', {'wohnt', 'in'}, names={'Stuttgart'}))

    def test_numbers_and_names_are_not_unglossed(self):
        out = self._unglossed('Ich wohne in Stuttgart und bin 7 Jahre da.', {'ich', 'wohne', 'in', 'und', 'bin', 'Jahre', 'da'}, names={'Stuttgart'})
        self.assertEqual(out.strip(), '')

    def test_many_new_glossary_words(self):
        forms = ['Wort' + chr(97 + i) * 2 for i in range(13)]
        glossary = {f: {'de': f, 'en': 'y', 'forms': [f]} for f in forms}
        ch = chapter()
        ch['beats'][0] = {'read': ' '.join(forms)}
        self.assertTrue(any('new glossary words' in w for w in run(ch, glossary=glossary)[1]))
        self.assertFalse(any('new glossary words' in w for w in run(ch, glossary={f: glossary[f] for f in forms[:12]})[1]))
        self.assertFalse(any('new glossary words' in w for w in run(ch, glossary=glossary, earlier_glossary=set(forms))[1]))

    def test_capitalised_form_does_not_cover_a_lower_case_token(self):
        # Stored "Früher" never matches "früher" inside a sentence: the word is not tappable
        ch = chapter()
        ch['beats'] = [{'read': 'Wer hat früher hier gewohnt?'}]
        ch['drill'] = []
        _, warnings = run(ch, glossary=gloss(['Früher', 'wer', 'hat', 'hier', 'gewohnt']))
        lines = [w for w in warnings if 'ungeglosst' in w]
        self.assertEqual(lines, ['ungeglosst: früher'])

    def test_word_of_an_earlier_chapter_without_entry_is_unglossed(self):
        # "summt" in A1 only as part of "summt … mit": a plain "summt" later has no entry
        ch = chapter()
        ch['beats'] = [{'read': 'Er summt.'}]
        ch['drill'] = []
        glossary = {**gloss(['er']), 'mitsummen': {'de': 'mit|summen', 'en': 'x', 'forms': ['summt … mit']}}
        self.assertIn('ungeglosst: summt', run(ch, glossary=glossary)[1])
        ch['beats'] = [{'read': 'Er summt mit.'}]
        self.assertFalse(any('ungeglosst' in w for w in run(ch, glossary=glossary)[1]))

    def test_blocklist_compounds(self):
        for word in ('Rotwein', 'Weißwein', 'Glühwein', 'Schweinefleisch', 'Schweinebraten', 'Bierchen',
                     'Küsschen', 'geküsst', 'Alkohol', 'alkoholfrei', 'umarmt', 'Kuss'):
            self.assertTrue(cs.blocked(word), word)
        for word in ('weinen', 'weint', 'geweint', 'Schweiz', 'Schweizer', 'probiert', 'Probier',
                     'Diskussion', 'Insekten', 'Wetter', 'Bild'):
            self.assertFalse(cs.blocked(word), word)

    def test_blocklist_warning_survives_a_glossary_entry(self):
        ch = chapter(extra={'read': 'Es gibt keinen Rotwein.'})
        glossary = {'Rotwein': {'de': 'der Rotwein', 'en': 'red wine', 'forms': ['Rotwein']}}
        _, warnings = run(ch, glossary=glossary)
        self.assertTrue(any(w.startswith('content word Rotwein') for w in warnings), warnings)

    def test_blocklist_is_a_warning_with_the_beat(self):
        ch = chapter(extra={'play': 'Er trinkt Bier', 'tags': 'S.m V.er O.n.akk', 'en': 'x'})
        errors, warnings = run(ch)
        self.assertEqual(errors, [])
        self.assertTrue(any('Er trinkt Bier' in w and 'Bier' in w for w in warnings))

    def test_missing_en(self):
        for level in ('A1', 'A2'):
            errors, warnings = run(chapter(en=False), level=level)
            self.assertTrue(any('no en translation' in e for e in errors), level)
            self.assertFalse(any('translation' in w for w in warnings), level)

    def test_boss_sentence(self):
        _, warnings = run(chapter(last='Ja'))
        self.assertTrue(any('boss' in w for w in warnings))
        self.assertFalse(any('boss' in w for w in run(chapter())[1]))

    def test_boss_boundary_third_longest(self):
        ch = chapter()
        lens = [len(b['play'].split()) for b in ch['beats'] if 'play' in b]
        ordered = sorted(lens, reverse=True)
        # last beat gets exactly the third-longest length: still allowed
        ch['beats'][-1]['play'] = ' '.join(['Wort'] * ordered[2] if ordered[2] >= 1 else ['Wort'])
        lens = sorted([len(b['play'].split()) for b in ch['beats'] if 'play' in b], reverse=True)
        self.assertEqual(len(ch['beats'][-1]['play'].split()), lens[2])
        self.assertFalse(any('boss' in w for w in run(ch)[1]))

    def test_boss_fourth_longest_warns(self):
        ch = chapter()
        for i, b in enumerate([b for b in ch['beats'] if 'play' in b][:3]):
            b['play'] = ' '.join(['Wort'] * (10 + i))
        ch['beats'][-1]['play'] = 'Wort Wort Wort Wort Wort Wort Wort Wort Wort'
        self.assertTrue(any('boss' in w for w in run(ch)[1]))

    def test_repeated_play_text(self):
        warnings = run(chapter(), earlier_plays={TEXTS[0]})[1]
        self.assertTrue(any('earlier chapter' in w and TEXTS[0] in w for w in warnings))
        self.assertFalse(any('earlier chapter' in w for w in run(chapter())[1]))

    def test_wordlist(self):
        ch = chapter()
        ch['beats'] = [{'play': 'Er geht heim', 'tags': 'S.m V.er X', 'en': 'x'}]
        ch['drill'] = []
        _, warnings = run(ch, wordlist={'er', 'geht'})
        self.assertTrue(any('word list' in w and 'heim' in w and 'geht' not in w for w in warnings))
        _, warnings = run(ch, wordlist=None)
        self.assertFalse(any('word list' in w for w in warnings))

    def test_sentence_start_is_shown_in_lower_case_when_the_chapter_has_it(self):
        out = self._unglossed('Ein Tag. Es ist ein Tag.', {'Tag', 'es', 'ist'})
        self.assertEqual(out.strip(), 'ein')


class NamesTest(unittest.TestCase):
    def test_load_names_skips_comments_and_blank_lines(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'names.txt')
            with open(path, 'w', encoding='utf-8') as f:
                f.write('# people\nAyisha\n\n  Stuttgart  \nMax # trailing\n')
            self.assertEqual(cs.load_names(path), {'Ayisha', 'Stuttgart', 'Max'})

    def test_missing_names_file_is_empty(self):
        self.assertEqual(cs.load_names('/nonexistent/names.txt'), set())


class RealFilesTest(unittest.TestCase):
    def test_load_skills(self):
        self.assertEqual(SKILLS[0], 'A1.nom')
        self.assertGreater(SKILLS.index('B1.genitiv'), SKILLS.index('A2.nebensatz'))

    def test_every_story_file_has_no_errors_and_no_unglossed_word(self):
        files = sorted(glob.glob(os.path.join(bs.STORIES_DIR, '*', '*.json')))
        self.assertGreaterEqual(len(files), 6)
        result = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'check_story.py'), *files],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertTrue(result.stdout.splitlines()[-1].startswith('0 errors'))
        self.assertNotIn('ungeglosst', result.stdout)

    def test_paths_are_relative_to_the_repo(self):
        self.assertNotIn('..', os.path.relpath(bs.REPO_ROOT, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.assertEqual(bs.REPO_ROOT, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.assertEqual(cs.display_path(os.path.join(bs.STORIES_DIR, 'A1', 'x.json')), 'data/stories/A1/x.json')
        self.assertEqual(cs.display_path('/elsewhere/x.json'), '/elsewhere/x.json')


class BuildTest(unittest.TestCase):
    """Pictures and glossaries across levels (build_stories.py)."""

    def test_a_chapter_uses_a_picture_of_a_lower_level(self):
        images = {lv: bs.chapter_images(lv) for lv in ('A1', 'A2')}
        self.assertIn('wg-kueche', images['A1'])
        ch = {'id': '1.2', 'title': 'T', 'image': {'place': 'wg-kueche', 'alt': 'Die Küche.'}}
        warnings = []
        image = bs.chapter_image('A2', ch, bs.inherited_images(images, 'A2'), warnings)
        self.assertEqual(warnings, [])
        self.assertTrue(image['src'].startswith('data/stories/A1/img/wg-kueche.svg?v='), image)

    def test_own_level_picture_wins(self):
        images = {'A1': {'park': '/r/A1/img/park.svg'}, 'A2': {'park': '/r/A2/img/park.webp'}}
        self.assertEqual(bs.inherited_images(images, 'A2')['park'], '/r/A2/img/park.webp')
        self.assertEqual(bs.inherited_images(images, 'A1')['park'], '/r/A1/img/park.svg')

    def test_a_picture_used_only_by_a_higher_level_is_not_stray(self):
        images = {'A1': {'park': '/r/A1/img/park.svg'}, 'A2': {}}
        files = {'A1': ['/r/A1/img/park.svg', '/r/A1/img/park.txt', '/r/A1/img/alt.svg'], 'A2': []}
        chapters = {'A1': [], 'A2': [{'id': '4.4', 'image': {'place': 'park'}}]}
        self.assertEqual(bs.stray_images(images, files, chapters), [('A1', 'alt.svg')])

    def test_cross_level_form_conflict_warns(self):
        glossaries = {
            'A1': {'gehen': {'de': 'gehen', 'en': 'to go', 'forms': ['geht']}},
            'A2': {'losgehen': {'de': 'los|gehen', 'en': 'to set off', 'forms': ['geht', 'los']}},
        }
        warnings = bs.cross_level_form_conflicts(glossaries)
        self.assertEqual(len(warnings), 1, warnings)
        self.assertIn('"geht"', warnings[0])
        self.assertIn('losgehen', warnings[0])
        # the same key redefined in the higher level replaces the lower entry and its forms: no conflict
        glossaries['A2']['gehen'] = {'de': 'gehen', 'en': 'x', 'forms': ['gehe']}
        self.assertEqual(bs.cross_level_form_conflicts(glossaries), [])
        self.assertEqual(bs.cross_level_form_conflicts({'A1': glossaries['A1']}), [])


class ReviewSheetTest(unittest.TestCase):
    def sheet(self, errors=(), warnings=(), new_words=None):
        story = {'level': 'A2', 'glossary': {
            'Aerztin': {'de': 'die Ärztin, -nen', 'en': 'doctor (f.)', 'forms': ['Ärztin']},
            'Koffer': {'de': 'der Koffer, -', 'en': 'suitcase', 'forms': ['Koffer']}}}
        ch = {'id': '1.1', 'title': 'Ankunft', 'skill': 'A1.nom', 'image': {'place': 'flughafen', 'alt': 'x'},
              'drillTitle': 'Üben',
              'beats': [{'read': 'Sie ist müde.', 'speaker': 'Ayisha'},
                        {'play': 'Ich bin Ärztin.', 'tags': 'S.ich V.ich S.f', 'en': 'I am a doctor.'},
                        {'play': 'Der Koffer ist schwer.', 'tags': 'S.m V.er X'}],
              'drill': [{'play': 'Ich bin hier.', 'tags': 'S.ich V.ich X', 'en': 'I am here.'}]}
        return sr.review_sheet('A2', story, ch, list(errors), list(warnings), new_words)

    def test_sheet_sections_and_lines(self):
        s = self.sheet()
        self.assertTrue(s.startswith('# A2 1.1 Ankunft\n'))
        self.assertIn('Skill: A1.nom · Ort: flughafen', s)
        self.assertIn('**Ayisha:**', s)
        self.assertIn('**Ich bin Ärztin.** — *I am a doctor.*', s)
        self.assertIn('**Der Koffer ist schwer.**\n', s)
        self.assertNotIn('**Der Koffer ist schwer.** —', s)
        self.assertIn('Keine Hinweise.', s)
        order = [s.index(h) for h in ('## Geschichte', '## Übung', '## Neue Wörter', '## Prüfung')]
        self.assertEqual(order, sorted(order))
        self.assertIn('**Ich bin hier.** — *I am here.*', s.split('## Übung')[1])

    def test_new_words_and_findings(self):
        s = self.sheet(errors=['E1'], warnings=['W1'], new_words={'Koffer': {'de': 'der Koffer, -', 'en': 'suitcase', 'forms': ['Koffer']}})
        words = s.split('## Neue Wörter')[1].split('## Prüfung')[0]
        self.assertIn('der Koffer, - — suitcase', words)
        escaped = self.sheet(new_words={'x': {'de': 'das *Wort*_', 'en': 'a_b', 'forms': ['Wort']}})
        self.assertIn('- das \\*Wort\\*\\_ — a\\_b', escaped)
        self.assertNotIn('Ärztin', words)
        check = s.split('## Prüfung')[1]
        self.assertLess(check.index('E1'), check.index('W1'))
        self.assertNotIn('Keine Hinweise.', s)

    def test_new_word_from_another_files_glossary_is_listed(self):
        other = {'de': 'die Tasche, -n', 'en': 'bag', 'forms': ['Tasche']}
        s = self.sheet(new_words={'Tasche': other})
        self.assertIn('die Tasche, -n — bag', s.split('## Neue Wörter')[1])

    def test_checked_chapters_resolve_new_words_across_files_and_drill(self):
        path = os.path.join(bs.STORIES_DIR, 'A1', '01_ankunft.json')
        first = [r for r in cs.checked_chapters([path]) if r[2]['id'] == '1.1'][0]
        new_words = first[5]
        story_glossary = first[1]['glossary']
        self.assertTrue(set(new_words) - set(story_glossary), 'expected keys from other story files')
        drill_only = cs.glossary_keys({'beats': [], 'drill': first[2]['drill']}, new_words) \
            - cs.glossary_keys({'beats': first[2]['beats'], 'drill': []}, new_words)
        for k in drill_only:
            self.assertIn(k, new_words)

    def test_story_text_is_escaped(self):
        line = sr.item_line({'play': 'Das ist *toll* _so_', 'en': 'a_b *c*'})
        self.assertEqual(line, '**Das ist \\*toll\\* \\_so\\_** — *a\\_b \\*c\\**')
        self.assertEqual(sr.item_line({'read': '# Titel', 'speaker': 'A_B'}), '**A\\_B:** \\# Titel')

    def test_cli_writes_a_file_per_chapter(self):
        script = os.path.join(os.path.dirname(__file__), 'story_review.py')
        path = os.path.join(bs.STORIES_DIR, 'A1', '01_ankunft.json')
        result = subprocess.run([sys.executable, script, path, '1.1'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        out = result.stdout.strip()
        self.assertTrue(out.endswith('A1_1.1.md'), out)
        self.assertNotIn('..', out)
        self.assertTrue(os.path.exists(out))


if __name__ == '__main__':
    unittest.main()
