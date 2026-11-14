import importlib.util
import os
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_concert_assets', os.path.join(ROOT, 'tools', 'gen-concert-assets.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ConcertGlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.glows = mod.make_glows()

    def test_three_groups_matching_the_theme(self):
        self.assertEqual(sorted(self.glows), ['cyan', 'magenta', 'wall'])

    def test_size_matches_scenery_and_is_rgba(self):
        for im in self.glows.values():
            self.assertEqual(im.size, (mod.W, mod.BG_H))
            self.assertEqual(im.mode, 'RGBA')

    def test_seamless_and_clear_at_top_and_bottom(self):
        for name, im in self.glows.items():
            a = im.getchannel('A')
            for y in range(mod.BG_H):
                self.assertLess(abs(a.getpixel((0, y)) - a.getpixel((mod.W - 1, y))), 12, name)
            self.assertEqual(a.crop((0, 0, mod.W, 8)).getextrema()[1], 0, name)
            self.assertEqual(a.crop((0, mod.BG_H - 8, mod.W, mod.BG_H)).getextrema()[1], 0, name)

    def test_groups_are_not_empty(self):
        for name, im in self.glows.items():
            self.assertGreater(im.getchannel('A').getextrema()[1], 100, name)


if __name__ == '__main__':
    unittest.main()
