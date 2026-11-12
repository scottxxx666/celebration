import importlib.util
import os
import re
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_desert_assets', os.path.join(ROOT, 'tools', 'gen-desert-assets.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

W, ROAD_H, BG_H = mod.W, mod.ROAD_H, mod.BG_H
LINES = (180, 360)
DASH_START = (mod.DASH_PERIOD - mod.DASH_LEN) // 2


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
    block = re.search(r'desert:\s*{(.*?)\n  },', src, re.S).group(1)
    v = int(re.search(field + r':\s*0x([0-9a-fA-F]{6})', block).group(1), 16)
    return (v >> 16, (v >> 8) & 255, v & 255)


class DesertRoadTest(unittest.TestCase):
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

    def test_lane_dashes_brighter_than_asphalt_and_gaps_clear(self):
        for y in LINES:
            for k in range(0, W // mod.DASH_PERIOD - 1, 3):
                x0 = k * mod.DASH_PERIOD + DASH_START
                dash = band_mean(self.img, x0, x0 + mod.DASH_LEN, y - 2, y + 2)
                above = band_mean(self.img, x0, x0 + mod.DASH_LEN, y - 14, y - 8)
                below = band_mean(self.img, x0, x0 + mod.DASH_LEN, y + 8, y + 14)
                self.assertGreater(dash, above + 20)
                self.assertGreater(dash, below + 20)
                gx = x0 + mod.DASH_LEN + 4
                gap = band_mean(self.img, gx, gx + mod.DASH_PERIOD - mod.DASH_LEN - 8, y - 2, y + 2)
                self.assertLess(gap, above + 12)

    def test_sandy_shoulder_confined_to_top_band(self):
        self.assertEqual(self.img.getpixel((W // 3, 0)), mod.SHOULDER_LIP)
        shoulder = band_mean(self.img, 0, W, 0, 6)
        asphalt = band_mean(self.img, 0, W, 60, 80)
        self.assertGreater(shoulder, asphalt + 30)

    def test_mid_value_so_black_shadow_reads(self):
        for y in (100, 270, 450):
            m = band_mean(self.img, 0, W, y, y + 10)
            self.assertGreater(m, 90)
            self.assertLess(m, 165)


class DesertSceneryTest(unittest.TestCase):
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

    def test_theme_hexes_match_edge_rows(self):
        for got, want in ((mod.row_avg(self.img, 0), theme_hex('sky')),
                          (mod.row_avg(self.road, ROAD_H - 1), theme_hex('ground'))):
            for a, b in zip(got, want):
                self.assertLessEqual(abs(a - b), 2)

    def test_overcast_sky_plain_at_the_top(self):
        # clouds fade out before the top rows, so the sky fill above the strip has no seam
        vals = [lum(self.img.getpixel((x, 4))) for x in range(0, W, 4)]
        self.assertLess(max(vals) - min(vals), 10)
        r, g, b = mod.row_avg(self.img, 0)
        self.assertGreaterEqual(r, b)  # brown-grey dust overcast, never a blue sky

    def test_dunes_are_warm_sand_below_the_haze(self):
        r, g, b = mod.row_avg(self.img, BG_H - 20)
        self.assertGreater(r, b + 25)

    def test_shipped_files_match_generator(self):
        for name, im in (('scenery-desert.png', self.img), ('road-desert.png', self.road)):
            shipped = Image.open(os.path.join(mod.OUT, name)).convert('RGB')
            self.assertEqual(shipped.tobytes(), im.tobytes(), name)


if __name__ == '__main__':
    unittest.main()
