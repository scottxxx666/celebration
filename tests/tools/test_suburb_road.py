import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location(
    'gen_suburb_road', os.path.join(ROOT, 'tools', 'gen-suburb-road.py'))
road_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(road_mod)

W, H = road_mod.W, road_mod.ROAD_H
LINES = (180, 360)
DASH_START = (road_mod.DASH_PERIOD - road_mod.DASH_LEN) // 2


def lum(p):
    return sum(p) / 3


def band_mean(im, x0, x1, y0, y1):
    vals = [lum(im.getpixel((x, y))) for x in range(x0, x1) for y in range(y0, y1)]
    return sum(vals) / len(vals)


class SuburbRoadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.img = road_mod.make_road()

    def test_size_and_mode(self):
        self.assertEqual(self.img.size, (1600, 540))
        self.assertEqual(self.img.mode, 'RGB')

    def test_deterministic(self):
        self.assertEqual(self.img.tobytes(), road_mod.make_road().tobytes())

    def test_seam_continuity(self):
        deltas = [max(abs(a - b) for a, b in zip(self.img.getpixel((0, y)),
                                                 self.img.getpixel((W - 1, y))))
                  for y in range(H)]
        self.assertLess(sum(deltas) / H, 8)
        self.assertLess(max(deltas), 50)

    def test_lane_dashes_brighter_than_asphalt_and_gaps_clear(self):
        for y in LINES:
            for k in range(0, W // road_mod.DASH_PERIOD - 1, 3):
                x0 = k * road_mod.DASH_PERIOD + DASH_START
                dash = band_mean(self.img, x0, x0 + road_mod.DASH_LEN, y - 2, y + 2)
                above = band_mean(self.img, x0, x0 + road_mod.DASH_LEN, y - 14, y - 8)
                below = band_mean(self.img, x0, x0 + road_mod.DASH_LEN, y + 8, y + 14)
                self.assertGreater(dash, above + 40)
                self.assertGreater(dash, below + 40)
                gx = x0 + road_mod.DASH_LEN + 4
                gap = band_mean(self.img, gx, gx + road_mod.DASH_PERIOD - road_mod.DASH_LEN - 8,
                                y - 2, y + 2)
                self.assertLess(gap, above + 12)

    def test_curb_is_subtle_and_confined_to_top_band(self):
        curb = band_mean(self.img, 0, W, 2, road_mod.CURB_H - 2)
        asphalt = band_mean(self.img, 0, W, 40, 60)
        # a hint of kerb, not a light band under the horizon
        self.assertGreater(curb, asphalt - 4)
        self.assertLess(curb, asphalt + 12)
        # top row (what the scenery horizon fades into) stays dark asphalt-toned
        self.assertLess(band_mean(self.img, 0, W, 0, 1), asphalt + 15)
        # below the gutter shadow the back lane is plain asphalt again
        below = band_mean(self.img, 0, W, road_mod.CURB_H + 12, road_mod.CURB_H + 28)
        self.assertLess(abs(below - asphalt), 6)

    def test_shadow_visible_on_asphalt(self):
        for y in (100, 270, 450):
            m = band_mean(self.img, 0, W, y, y + 10)
            self.assertGreater(m, 25)
            self.assertLess(m, 90)


if __name__ == '__main__':
    unittest.main()
