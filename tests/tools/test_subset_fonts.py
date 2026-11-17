import importlib.util
import json
import os
import tempfile
import unittest

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location('subset_fonts', os.path.join(ROOT, 'tools', 'subset-fonts.py'))
sf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sf)


def make_font(path, chars):
    """A tiny TTF whose cmap covers `chars` (square glyphs, enough to subset)."""
    names = ['.notdef'] + [f'uni{ord(c):04X}' for c in chars]
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({ord(c): f'uni{ord(c):04X}' for c in chars})
    glyphs = {}
    for name in names:
        pen = TTGlyphPen(None)
        pen.moveTo((0, 0)); pen.lineTo((0, 500)); pen.lineTo((500, 500)); pen.lineTo((500, 0)); pen.closePath()
        glyphs[name] = pen.glyph()
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (600, 0) for n in names})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Test', 'styleName': 'Regular'})
    fb.setupOS2()
    fb.setupPost()
    fb.save(path)


def fake_cfg(text):
    return {
        'strings': {'xx': {'a': text, 'b': 'line1\nline2'}},
        'labels': {'xx': '語'},
        'faces': [{'lang': 'xx', 'family': 'F', 'weight': '400', 'file': 'x.woff2', 'source': 'x.ttf'}],
    }


class NeededChars(unittest.TestCase):
    def test_collects_strings_label_ascii_and_ui_glyphs_but_not_newlines(self):
        need = sf.needed_chars(fake_cfg('中文'), 'xx')
        self.assertTrue(set('中文語') <= need)       # strings + the language's own label
        self.assertTrue({'A', ' ', '~', '◀', '▶'} <= need)
        self.assertNotIn('\n', need)

    def test_only_the_requested_language(self):
        cfg = fake_cfg('中')
        cfg['strings']['yy'] = {'a': '韓'}
        cfg['labels']['yy'] = '韓'
        self.assertNotIn('韓', sf.needed_chars(cfg, 'xx'))


class SubsetAndCheck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.src = os.path.join(self.dir, 'x.ttf')
        make_font(self.src, 'AB 中文語◀▶')
        self.out = os.path.join(self.dir, 'out')
        self.gaps = os.path.join(self.dir, 'gaps.json')

    def tearDown(self):
        self.tmp.cleanup()

    def test_subset_keeps_only_requested_chars_as_woff2(self):
        dst = os.path.join(self.dir, 'x.woff2')
        sf.subset_font(self.src, dst, set('A中'))
        self.assertEqual(sf.cmap_of(dst), set('A中'))
        with open(dst, 'rb') as f:
            self.assertEqual(f.read(4), b'wOF2')

    def test_generate_then_check_passes_and_records_noto_gaps(self):
        cfg = fake_cfg('中文Ω')  # Omega is not in the source font
        cfg['faces'][0]['source'] = 'x.ttf'
        sf.generate(cfg, [self.dir], self.out, self.gaps)
        with open(self.gaps, encoding='utf-8') as f:
            self.assertEqual(json.load(f)['xx'].count('Ω'), 1)
        problems, reported = sf.check(cfg, self.out, self.gaps)
        self.assertEqual(problems, [])
        self.assertTrue(any('Ω' in r for r in reported))

    def test_check_fails_for_a_new_string_char_and_for_a_missing_file(self):
        cfg = fake_cfg('中文')
        sf.generate(cfg, [self.dir], self.out, self.gaps)
        edited = fake_cfg('中文A' + '◀' + '語')  # still covered
        self.assertEqual(sf.check(edited, self.out, self.gaps)[0], [])
        edited = fake_cfg('中文新')               # 新 was added to strings after subsetting
        problems, _ = sf.check(edited, self.out, self.gaps)
        self.assertEqual(len(problems), 1)
        self.assertIn('新', problems[0])
        os.remove(os.path.join(self.out, 'x.woff2'))
        problems, _ = sf.check(edited, self.out, self.gaps)
        self.assertIn('missing file', problems[0])


class CommittedFonts(unittest.TestCase):
    def test_real_subsets_cover_every_string(self):
        cfg = sf.load_config()
        self.assertEqual(sorted({f['lang'] for f in cfg['faces']}), ['ja', 'ko', 'zh-Hans', 'zh-Hant'])
        problems, _ = sf.check(cfg)
        self.assertEqual(problems, [])


if __name__ == '__main__':
    unittest.main()
