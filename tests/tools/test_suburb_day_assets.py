import importlib.util
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_suburb_day_assets', os.path.join(ROOT, 'tools', 'gen-suburb-day-assets.py'))
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
    block = re.search(r'suburbDay:\s*{(.*?)\n  },', src, re.S).group(1)
    v = int(re.search(field + r':\s*0x([0-9a-fA-F]{6})', block).group(1), 16)
    return (v >> 16, (v >> 8) & 255, v & 255)


class SuburbDayRoadTest(unittest.TestCase):
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

    def test_not_vertically_tiled(self):
        # top (curb) and bottom (near asphalt) rows differ clearly
        self.assertGreater(abs(band_mean(self.img, 0, W, 0, 1)
                               - band_mean(self.img, 0, W, ROAD_H - 1, ROAD_H)), 20)

    def test_lane_dashes_brighter_than_asphalt_and_gaps_clear(self):
        for y in LINES:
            for k in range(0, W // mod.DASH_PERIOD - 1, 3):
                x0 = k * mod.DASH_PERIOD + DASH_START
                dash = band_mean(self.img, x0, x0 + mod.DASH_LEN, y - 2, y + 2)
                above = band_mean(self.img, x0, x0 + mod.DASH_LEN, y - 14, y - 8)
                below = band_mean(self.img, x0, x0 + mod.DASH_LEN, y + 8, y + 14)
                self.assertGreater(dash, above + 25)
                self.assertGreater(dash, below + 25)
                gx = x0 + mod.DASH_LEN + 4
                gap = band_mean(self.img, gx, gx + mod.DASH_PERIOD - mod.DASH_LEN - 8, y - 2, y + 2)
                self.assertLess(gap, above + 12)

    def test_light_curb_confined_to_top_band(self):
        curb = band_mean(self.img, 0, W, 0, mod.CURB_H - mod.CURB_FACE_H)
        asphalt = band_mean(self.img, 0, W, 40, 60)
        self.assertGreater(curb, asphalt + 30)  # light concrete kerb
        self.assertEqual(self.img.getpixel((W // 3, 0)), mod.CURB_LIP)
        below = band_mean(self.img, 0, W, mod.CURB_H + 12, mod.CURB_H + 28)
        self.assertLess(abs(below - asphalt), 8)

    def test_mid_value_so_black_shadow_reads(self):
        for y in (100, 270, 450):
            m = band_mean(self.img, 0, W, y, y + 10)
            self.assertGreater(m, 90)
            self.assertLess(m, 160)


class SuburbDaySceneryTest(unittest.TestCase):
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
        # per-pixel grain makes any two neighbouring columns differ a little;
        # the wrap seam must not stand out from an ordinary interior join
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

    def test_sky_is_blue_and_plain_at_the_top(self):
        r, g, b = mod.row_avg(self.img, 0)
        self.assertGreater(b, r + 30)  # daytime blue, not grey-cream overcast
        # clouds stay below the top rows, so the sky fill above the strip has no seam
        vals = [lum(self.img.getpixel((x, 4))) for x in range(0, W, 4)]
        self.assertLess(max(vals) - min(vals), 10)

    def test_no_snow_like_speckle(self):
        # neighbouring sky pixels must be smooth: no per-pixel grain
        diffs = [abs(lum(self.img.getpixel((x, 8))) - lum(self.img.getpixel((x + 1, 8))))
                 for x in range(0, W - 1)]
        self.assertLess(max(diffs), 4)

    def test_bottom_rows_fade_from_verge_into_curb(self):
        # the verge just above the edge rows is green, the last row is the curb lip
        r, g, b = mod.row_avg(self.img, BG_H - mod.EDGE_ROWS - 2)
        self.assertGreater(g, r)
        self.assertGreater(g, b)
        self.assertEqual(mod.row_avg(self.img, BG_H - 1), mod.CURB_LIP)

if __name__ == '__main__':
    unittest.main()
