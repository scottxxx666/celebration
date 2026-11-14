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

    def test_shipped_scenery_size_and_exact_sky(self):
        self.assertEqual(self.bg.size, (mod.W, mod.BG_H))
        want = theme_hex('sky')
        for x in range(mod.W):
            self.assertEqual(self.bg.getpixel((x, 0)), want)

    def test_lit_lamp_lenses_are_dark_glass(self):
        for i in (0, 2, 3, 5, 7, 8):
            x = 60 + 160 * i
            for dx in (-8, 0, 8):
                self.assertLess(max(self.bg.getpixel((x + 1 + dx, 92))), 60, (i, dx))

    def test_glow_lens_covers_the_lens(self):
        glows = mod.make_glows()
        for name, mods in (('magenta', (0, 1)), ('cyan', (2,))):
            for i in (0, 2, 3, 5, 7, 8):
                if i % 3 in mods:
                    x = 60 + 160 * i
                    for dx in (-10, 0, 12):
                        self.assertGreater(glows[name].getpixel((x + 1 + dx, 92))[3], 200, (name, i, dx))

    def test_relit_lens_reproduces_the_original_lit_lens(self):
        P = mod.lamps_prep
        lit = Image.open(P.LIT_PATCHES).convert('RGB')
        glows = mod.make_glows()
        worst = 0
        for n, i in enumerate((0, 2, 3, 5, 7, 8)):
            glow = glows['magenta' if i % 3 in (0, 1) else 'cyan']
            x0, y0, _, _ = P.lens_box(P.LAMP_XS[n])
            cx = P.LAMP_XS[n] + P.LENS_DX
            for py in range(P.PATCH_H):
                for pxx in range(P.PATCH_W):
                    x, y = x0 + pxx, y0 + py
                    if not P.in_lens(x, y, cx):
                        continue
                    base, gl = self.bg.getpixel((x, y)), glow.getpixel((x, y))
                    got = tuple(min(255, b + g * gl[3] // 255) for b, g in zip(base, gl[:3]))
                    want = lit.getpixel((n * P.PATCH_W + pxx, py))
                    worst = max(worst, max(abs(a - b) for a, b in zip(got, want)))
        self.assertLessEqual(worst, 30)   # only where the dimmed base is brighter than the lit pixel (clipped diff)

    def test_glow_alpha_stays_within_lens_and_halo_radius(self):
        P = mod.lamps_prep
        lit_xs = [P.LAMP_XS[n] for n in range(6)]
        for name, glow in mod.make_glows().items():
            if name == 'wall':
                continue
            al = glow.getchannel('A')
            for x in range(0, mod.W, 3):
                near = any(min(abs(x - lx), mod.W - abs(x - lx)) <= 125 for lx in lit_xs)
                if not near:
                    self.assertEqual(al.crop((x, 0, x + 1, mod.BG_H)).getextrema()[1], 0, (name, x))

    def test_haze_ring_matches_the_surround_tone(self):
        P = mod.lamps_prep
        px = self.bg.load()
        for lx in P.LAMP_XS:
            cx = lx + P.LENS_DX
            tone = P.surround_tone(px, mod.W, cx)
            dist = []
            for y in range(P.LENS_CY - 24, P.LENS_CY + 25):
                for x in range(cx - 28, cx + 29):
                    d2 = ((x - cx) / 28) ** 2 + ((y - P.LENS_CY) / 24) ** 2
                    if d2 < 1 and not P.in_lens(x, y, cx) and 0.1 < d2 and not (
                            abs(x - cx) <= P.HAZE_BODY_HW and y < P.LENS_CY + 4):
                        p = px[x, y]
                        if max(p) < 60:           # the dark haze, not truss or hardware
                            dist.append(max(abs(a - b) for a, b in zip(p, tone)))
            self.assertLess(sum(dist) / len(dist), 9, lx)

    def test_haze_step_touches_only_its_ellipse(self):
        P = mod.lamps_prep
        import random
        r = random.Random(3)
        im = Image.new('RGB', (mod.W, 160))
        px = im.load()
        for y in range(160):
            for x in range(mod.W):
                px[x, y] = (r.randrange(40), r.randrange(40), r.randrange(40))
        before = im.copy()
        P.neutralise_haze(im)
        for y in range(160):
            for x in range(mod.W):
                inside = any(((x - (lx + P.LENS_DX)) / P.HAZE_RX) ** 2 + ((y - P.LENS_CY) / P.HAZE_RY) ** 2 < 1
                             for lx in P.LAMP_XS)
                if not inside:
                    self.assertEqual(im.getpixel((x, y)), before.getpixel((x, y)))

    def test_prep_concert_lamps_is_idempotent(self):
        spec = importlib.util.spec_from_file_location(
            'prep_concert_lamps', os.path.join(ROOT, 'tools', 'prep-concert-lamps.py'))
        prep = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(prep)
        once = prep.prep(self.bg)
        self.assertEqual(list(once.getdata()), list(prep.prep(once).getdata()))
        self.assertEqual(list(once.getdata()), list(self.bg.getdata()))

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
