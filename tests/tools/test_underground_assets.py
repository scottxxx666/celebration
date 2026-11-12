import importlib.util
import os
import re
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_underground_assets', os.path.join(ROOT, 'tools', 'gen-underground-assets.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

W, ROAD_H, BG_H = mod.W, mod.ROAD_H, mod.BG_H
LINES = (180, 360)


def lum(p):
    return sum(p) / 3


def band_mean(im, x0, x1, y0, y1):
    vals = [lum(im.getpixel((x, y))) for x in range(x0, x1) for y in range(y0, y1)]
    return sum(vals) / len(vals)


def col_delta(im, xa, xb):
    return [max(abs(a - b) for a, b in zip(im.getpixel((xa, y)), im.getpixel((xb, y))))
            for y in range(im.height)]


def theme_hex(field):
    with open(os.path.join(ROOT, 'src', 'config', 'sceneryThemes.js')) as f:
        src = f.read()
    block = re.search(r'underground:\s*{(.*?)\n  },', src, re.S).group(1)
    v = int(re.search(field + r':\s*0x([0-9a-fA-F]{6})', block).group(1), 16)
    return (v >> 16, (v >> 8) & 255, v & 255)


class UndergroundRoadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.img = mod.make_road()

    def test_size_and_mode(self):
        self.assertEqual(self.img.size, (1600, 540))
        self.assertEqual(self.img.mode, 'RGB')

    def test_deterministic(self):
        self.assertEqual(self.img.tobytes(), mod.make_road().tobytes())

    def test_seam_continuity(self):
        deltas = col_delta(self.img, 0, W - 1)
        self.assertLess(sum(deltas) / ROAD_H, 8)
        self.assertLess(max(deltas), 50)

    def test_row_joints_darker_than_slabs(self):
        for y in LINES:
            joint = band_mean(self.img, 0, W, y - 1, y + 1)
            slab = band_mean(self.img, 0, W, y + 12, y + 20)
            self.assertLess(joint, slab - 5)

    def test_wall_base_grime_at_top_row(self):
        self.assertEqual(self.img.getpixel((W // 3, 0)), mod.FLOOR_LIP)
        self.assertLess(band_mean(self.img, 0, W, 0, 6), band_mean(self.img, 0, W, 80, 100) - 6)

    def test_mid_dark_so_black_shadow_still_reads(self):
        for y in (100, 270, 450):
            m = band_mean(self.img, 0, W, y, y + 10)
            self.assertGreater(m, 20)
            self.assertLess(m, 55)

    def test_shipped_road_matches_generator(self):
        shipped = Image.open(os.path.join(mod.OUT, 'road-underground.png')).convert('RGB')
        self.assertEqual(shipped.tobytes(), self.img.tobytes())


class UndergroundSceneryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.img = mod.make_bg()
        cls.road = mod.make_road()

    def test_size_and_mode(self):
        self.assertEqual(self.img.size, (1600, 360))
        self.assertEqual(self.img.mode, 'RGB')

    def test_deterministic(self):
        self.assertEqual(self.img.tobytes(), mod.make_bg().tobytes())

    def test_seam_no_worse_than_interior(self):
        seam = col_delta(self.img, 0, W - 1)
        interior = col_delta(self.img, W // 2 - 1, W // 2)
        self.assertLess(sum(seam) / BG_H, sum(interior) / BG_H + 4)
        self.assertLess(sum(seam) / BG_H, 8)

    def test_horizon_meets_road_top_row(self):
        self.assertEqual(mod.row_avg(self.img, BG_H - 1), mod.row_avg(self.road, 0))

    def test_edge_rows_match_theme_fills(self):
        for a, b in zip(mod.row_avg(self.img, 0), theme_hex('sky')):
            self.assertLessEqual(abs(a - b), 2)
        for a, b in zip(mod.row_avg(self.road, ROAD_H - 1), theme_hex('ground')):
            self.assertLessEqual(abs(a - b), 2)

    def test_ceiling_plain_at_the_top(self):
        vals = [lum(self.img.getpixel((x, 1))) for x in range(0, W, 4)]
        self.assertLess(max(vals) - min(vals), 6)

    def test_dead_lamp_side_is_darker_than_a_lit_pool(self):
        lit_x = mod.LAMPS[0][0]
        dark_x = next(x for x, s in mod.LAMPS if s == 0)
        y0, y1 = mod.CEIL_H + 20, mod.CEIL_H + 120
        lit = band_mean(self.img, lit_x - 40, lit_x + 40, y0, y1)
        dark = band_mean(self.img, dark_x - 40, dark_x + 40, y0, y1)
        self.assertGreater(lit, dark + 25)

    def test_cold_teal_grade(self):
        r, g, b = mod.row_avg(self.img, mod.CEIL_H + 60)
        self.assertGreater(g, r * 1.25)  # ratio: the wall is dark, so absolute gaps are small

    def test_shipped_scenery_matches_generator(self):
        shipped = Image.open(os.path.join(mod.OUT, 'scenery-underground.png')).convert('RGB')
        self.assertEqual(shipped.tobytes(), self.img.tobytes())


class UndergroundFlickerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bg = mod.make_bg()
        cls.img = mod.make_flicker(cls.bg)
        lamps = tuple((x, mod.FLICKER_STRENGTH if x == mod.FLICKER_LAMP else s) for x, s in mod.LAMPS)
        cls.lit = mod.make_bg(lamps)

    def alpha_on(self, x0, x1):
        a = self.img.getchannel('A')
        return sum(1 for x in range(x0, x1) for y in range(BG_H) if a.getpixel((x, y)))

    def test_size_and_mode(self):
        self.assertEqual(self.img.size, (1600, 360))
        self.assertEqual(self.img.mode, 'RGBA')

    def test_deterministic(self):
        self.assertEqual(self.img.tobytes(), mod.make_flicker().tobytes())

    def test_alpha_is_binary(self):
        self.assertLessEqual(set(self.img.getchannel('A').getdata()), {0, 255})

    def test_clear_far_from_the_lamp(self):
        self.assertEqual(self.alpha_on(100, 300), 0)

    def test_covers_the_lamp_and_its_pool(self):
        lamp = mod.FLICKER_LAMP
        self.assertGreater(self.alpha_on(lamp - 60, lamp + 60), 0.5 * 120 * BG_H)
        self.assertEqual(self.img.getpixel((lamp, mod.CEIL_H - 8))[3], 255)

    def test_lit_lamp_is_brighter_than_the_dead_one(self):
        lamp = mod.FLICKER_LAMP
        y0, y1 = mod.CEIL_H + 20, mod.CEIL_H + 120
        self.assertGreater(band_mean(self.lit, lamp - 40, lamp + 40, y0, y1),
                           band_mean(self.bg, lamp - 40, lamp + 40, y0, y1) + 5)

    def test_full_alpha_composite_equals_lit_render(self):
        out = self.bg.copy()
        out.paste(self.img.convert('RGB'), mask=self.img.getchannel('A'))
        self.assertEqual(out.tobytes(), self.lit.tobytes())

    def test_alpha_seam_is_consistent(self):
        a = self.img.getchannel('A')
        self.assertEqual([a.getpixel((0, y)) for y in range(BG_H)],
                         [a.getpixel((W - 1, y)) for y in range(BG_H)])

    def test_shipped_flicker_matches_generator(self):
        shipped = Image.open(os.path.join(mod.OUT, 'scenery-underground-flicker.png')).convert('RGBA')
        self.assertEqual(shipped.tobytes(), self.img.tobytes())


if __name__ == '__main__':
    unittest.main()
