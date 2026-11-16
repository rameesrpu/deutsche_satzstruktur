"""Tests for scripts/check_story.py. Run: python3 -m unittest scripts/test_check_story.py"""

import glob
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import check_story as cs
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


ALL_KNOWN = {w.lower() for t in TEXTS for w in t.split()} | {'ein', 'morgen', 'satz', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'}


def run(ch, level='A1', known=None, glossary=None, **kw):
    return cs.check_chapter(level, ch, ALL_KNOWN if known is None else known, glossary or {}, SKILLS, **kw)


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
        glossary = {'schrank': {'de': 'x', 'en': 'wardrobe', 'forms': ['Schrank']}}
        ch['drill'] = []
        _, warnings = run(ch, known={'kauft', 'einen'}, glossary=glossary)
        line = [w for w in warnings if 'ungeglosst' in w][0]
        self.assertEqual(line.split(':', 1)[1].strip(), 'heute')

    def _unglossed(self, text, known):
        ch = chapter()
        ch['beats'] = [{'play': text, 'tags': 'X', 'en': 'x'}]
        ch['drill'] = []
        _, warnings = run(ch, known=set(known))
        lines = [w for w in warnings if 'ungeglosst' in w]
        return lines[0].split(':', 1)[1] if lines else ''

    def test_sentence_initial_capital_is_the_same_word(self):
        self.assertNotIn('Heute', self._unglossed('Heute kommt Faris.', {'heute', 'kommt'}))

    def test_noun_and_verb_are_different_words(self):
        self.assertIn('Essen', self._unglossed('Das Essen ist gut.', {'essen', 'das', 'ist', 'gut'}))

    def test_numbers_and_names_are_not_unglossed(self):
        out = self._unglossed('Ich wohne in Stuttgart und bin 7 Jahre da.', {'ich', 'wohne', 'in', 'und', 'bin', 'Jahre', 'da'})
        self.assertEqual(out.strip(), '')

    def test_many_new_glossary_words(self):
        forms = ['Wort' + chr(97 + i) * 2 for i in range(13)]
        glossary = {f: {'de': f, 'en': 'y', 'forms': [f]} for f in forms}
        ch = chapter()
        ch['beats'][0] = {'read': ' '.join(forms)}
        self.assertTrue(any('new glossary words' in w for w in run(ch, glossary=glossary)[1]))
        self.assertFalse(any('new glossary words' in w for w in run(ch, glossary={f: glossary[f] for f in forms[:12]})[1]))
        self.assertFalse(any('new glossary words' in w for w in run(ch, glossary=glossary, earlier_glossary=set(forms))[1]))

    def test_blocklist_is_a_warning_with_the_beat(self):
        ch = chapter(extra={'play': 'Er trinkt Bier', 'tags': 'S.m V.er O.n.akk', 'en': 'x'})
        errors, warnings = run(ch)
        self.assertEqual(errors, [])
        self.assertTrue(any('Er trinkt Bier' in w and 'Bier' in w for w in warnings))

    def test_missing_en(self):
        self.assertTrue(any('en' in e.split() for e in run(chapter(en=False), level='A2')[0]))
        errors, warnings = run(chapter(en=False), level='A1')
        self.assertFalse(any('translation' in e for e in errors))
        self.assertTrue(any('translation' in w for w in warnings))

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
        _, warnings = run(ch, known=set(), wordlist={'er', 'geht'})
        self.assertTrue(any('word list' in w and 'heim' in w and 'geht' not in w for w in warnings))
        _, warnings = run(ch, known=set(), wordlist=None)
        self.assertFalse(any('word list' in w for w in warnings))

    def test_chapter_words(self):
        ch = {'beats': [{'read': 'Heute ist Essen. Gut'}, {'play': 'Das geht', 'tags': 'X X'}],
              'drill': [{'play': 'Wir essen', 'tags': 'X X'}]}
        words = cs.chapter_words(ch)
        for w in ('Heute', 'heute', 'Essen', 'essen', 'geht', 'Das', 'das', 'wir', 'Wir', 'essen', 'gut'):
            self.assertIn(w, words)
        self.assertIn('ist', words)


class RealFilesTest(unittest.TestCase):
    def test_load_skills(self):
        self.assertEqual(SKILLS[0], 'A1.nom')
        self.assertGreater(SKILLS.index('B1.genitiv'), SKILLS.index('A2.nebensatz'))

    def test_five_real_a1_files_have_no_errors(self):
        files = sorted(glob.glob(os.path.join(bs.STORIES_DIR, 'A1', '*.json')))
        self.assertEqual(len(files), 5)
        result = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'check_story.py'), *files],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertTrue(result.stdout.splitlines()[-1].startswith('0 errors'))


if __name__ == '__main__':
    unittest.main()
