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


class ConcertCrowdTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames = [mod.make_crowd(0), mod.make_crowd(1)]
        cls.bg = mod.make_bg()

    def test_size_and_mode(self):
        for im in self.frames:
            self.assertEqual(im.size, (mod.W, mod.CROWD_H))
            self.assertEqual(im.mode, 'RGBA')

    def test_frames_differ_but_share_the_base_band(self):
        a, b = self.frames
        self.assertNotEqual(list(a.getdata()), list(b.getdata()))
        # bottom rows are solid crowd body in both
        self.assertEqual(a.crop((0, mod.CROWD_H - 6, mod.W, mod.CROWD_H)).getchannel('A').getextrema()[0], 255)
        self.assertEqual(b.crop((0, mod.CROWD_H - 6, mod.W, mod.CROWD_H)).getchannel('A').getextrema()[0], 255)

    def test_neighbours_use_opposite_poses(self):
        a, b = self.frames
        diff = sum(1 for pa, pb in zip(a.getchannel('A').getdata(), b.getchannel('A').getdata()) if pa != pb)
        self.assertGreater(diff, 5000)

    def test_seamless_alpha(self):
        for im in self.frames:
            al = im.getchannel('A')
            for y in range(mod.CROWD_H):
                self.assertLess(abs(al.getpixel((0, y)) - al.getpixel((mod.W - 1, y))), 130)

    def test_base_scenery_has_no_crowd_and_valid_edges(self):
        band = self.bg.crop((0, 300, mod.W, mod.BG_H - 6))
        self.assertLess(max(max(px) for px in band.getdata()), 45)
        self.assertEqual(mod.row_avg(self.bg, 0), mod.SKY)
        bottom = mod.row_avg(self.bg, mod.BG_H - 1)
        for got, want in zip(bottom, mod.LIP):
            self.assertLessEqual(abs(got - want), 2)


if __name__ == '__main__':
    unittest.main()
