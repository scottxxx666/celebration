import importlib.util
import os
import re
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_concert_assets', os.path.join(ROOT, 'tools', 'gen-concert-assets.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def theme_hex(field):
    with open(os.path.join(ROOT, 'src', 'config', 'sceneryThemes.js')) as f:
        src = f.read()
    block = re.search(r'concert:\s*{(.*?)\n  },', src, re.S).group(1)
    v = int(re.search(field + r':\s*0x([0-9a-fA-F]{6})', block).group(1), 16)
    return (v >> 16, (v >> 8) & 255, v & 255)


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
        cls.bg = Image.open(os.path.join(ROOT, 'public', 'assets', 'bg', 'scenery-concert.png')).convert('RGB')
        cls.road = Image.open(os.path.join(ROOT, 'public', 'assets', 'bg', 'road-concert.png')).convert('RGB')

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

    def test_shipped_scenery_size_and_sky(self):
        self.assertEqual(self.bg.size, (mod.W, mod.BG_H))
        want = theme_hex('sky')
        got = mod.row_avg(self.bg, 0)
        for g, w in zip(got, want):
            self.assertLessEqual(abs(g - w), 1)

    def test_shipped_scenery_seam_and_horizon(self):
        for y in range(mod.BG_H):
            a, b = self.bg.getpixel((0, y)), self.bg.getpixel((mod.W - 1, y))
            self.assertLessEqual(max(abs(p - q) for p, q in zip(a, b)), 12)
        bottom = mod.row_avg(self.bg, mod.BG_H - 1)
        road_top = mod.row_avg(self.road, 0)
        for g, w in zip(bottom, road_top):
            self.assertLessEqual(abs(g - w), 2)

    def test_shipped_scenery_bottom_band_is_clear_dark_deck(self):
        band = self.bg.crop((0, 300, mod.W, mod.BG_H - 6))
        self.assertLess(max(max(px) for px in band.getdata()), 60)

    def test_road_ground_matches_theme(self):
        want = theme_hex('ground')
        for g, w in zip(mod.row_avg(self.road, mod.ROAD_H - 1), want):
            self.assertLessEqual(abs(g - w), 1)


if __name__ == '__main__':
    unittest.main()
