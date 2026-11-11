import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOLS = os.path.join(ROOT, 'tools')
sys.path.insert(0, TOOLS)

from prep_common import ALPHA_NOISE_MAX, clean_alpha, require_transparency  # noqa: E402


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


runs = load('prep_run_frames', 'prep-run-frames.py')
RUN_SCRIPT = os.path.join(TOOLS, 'prep-run-frames.py')
OBSTACLE_SCRIPT = os.path.join(TOOLS, 'prep-obstacle-image.py')
scenery = load('prep_scenery_image', 'prep-scenery-image.py')
SCENERY_SCRIPT = os.path.join(TOOLS, 'prep-scenery-image.py')

H = 100
BLOB = (200, 50, 50, 255)


def sheet(width, blobs, height=H):
    """Transparent sheet with opaque blobs given as (x0, x1, y0, y1)."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for x0, x1, y0, y1 in blobs:
        img.paste(BLOB, (x0, y0, x1, y1))
    return img


def blob_centre(img):
    box = img.getchannel('A').getbbox()
    return (box[0] + box[2]) / 2


class RequireTransparencyTest(unittest.TestCase):
    def test_transparent_corners_pass(self):
        require_transparency(sheet(50, [(10, 20, 10, 20)]), 'x')

    def test_opaque_fails(self):
        img = Image.new('RGBA', (20, 20), (255, 255, 255, 255))
        with self.assertRaises(SystemExit) as cm:
            require_transparency(img, 'x.png')
        self.assertIn('x.png', str(cm.exception))
        self.assertIn('rembg', str(cm.exception))

    def test_drawn_checkerboard_fails(self):
        img = Image.new('RGBA', (32, 32))
        for y in range(32):
            for x in range(32):
                v = 255 if (x // 8 + y // 8) % 2 else 204
                img.putpixel((x, y), (v, v, v, 255))
        with self.assertRaises(SystemExit):
            require_transparency(img, 'x')

    def test_alpha_threshold(self):
        img = Image.new('RGBA', (10, 10), (0, 0, 0, 8))
        require_transparency(img, 'x')
        img.putpixel((9, 9), (0, 0, 0, 9))
        with self.assertRaises(SystemExit):
            require_transparency(img, 'x')


class SplitSheetTest(unittest.TestCase):
    def test_even_blobs_same_size_and_centred_alike(self):
        img = sheet(300, [(30, 70, 10, 90), (130, 170, 10, 90), (230, 270, 10, 90)])
        cells = runs.split_sheet(img, 3)
        self.assertEqual(len(cells), 3)
        self.assertEqual({c.size for c in cells}, {(100, H)})
        for c in cells:
            self.assertEqual(blob_centre(c), 50)

    def test_uneven_gaps_use_midpoints(self):
        img = sheet(300, [(10, 50, 0, 50), (60, 100, 0, 50), (200, 240, 0, 50)])
        cells = runs.split_sheet(img, 3)
        # boundaries: 0, 55, 150, 300 -> widths 55, 95, 150; padded to 150
        self.assertEqual({c.size for c in cells}, {(150, H)})
        # blob 0 sits at 10..50 in a 55-wide cell padded by (150-55)//2 = 47
        self.assertEqual(blob_centre(cells[0]), 47 + 30)
        self.assertEqual(blob_centre(cells[2]), 75 + (220 - 225))

    def test_wrong_count_exits_with_ranges(self):
        img = sheet(300, [(10, 50, 0, 50), (100, 140, 0, 50)])
        with self.assertRaises(SystemExit) as cm:
            runs.split_sheet(img, 3)
        msg = str(cm.exception)
        self.assertIn('found 2', msg)
        self.assertIn('10-50', msg)

    def test_specks_ignored(self):
        img = sheet(300, [(30, 70, 10, 90), (130, 170, 10, 90), (232, 234, 40, 42)])
        self.assertEqual(len(runs.split_sheet(img, 2)), 2)

    def test_blob_touching_edges(self):
        img = sheet(200, [(0, 40, 0, 100), (160, 200, 0, 100)])
        cells = runs.split_sheet(img, 2)
        self.assertEqual({c.size for c in cells}, {(100, H)})
        self.assertEqual(cells[0].getchannel('A').getbbox(), (0, 0, 40, 100))
        self.assertEqual(cells[1].getchannel('A').getbbox(), (60, 0, 100, 100))


def grid(width, height, rects, colours=None):
    """Transparent canvas with opaque rects (x0, x1, y0, y1)."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for i, (x0, x1, y0, y1) in enumerate(rects):
        img.paste(colours[i] if colours else BLOB, (x0, y0, x1, y1))
    return img


class ParseSheetTest(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(runs.parse_sheet('6'), (6, 1))
        self.assertEqual(runs.parse_sheet('3x2'), (3, 2))
        self.assertEqual(runs.parse_sheet('3X2'), (3, 2))

    def test_invalid(self):
        for bad in ('0', '-2', 'abc', '3x', 'x2', '3x0', '0x2', '3x2x1', '', '2.5', '3x-1'):
            with self.subTest(bad=bad), self.assertRaises(SystemExit):
                runs.parse_sheet(bad)


class SplitGridTest(unittest.TestCase):
    def six(self):
        # 3 cols x 2 rows on 300x200; blob height = 20 + 10 * index so each
        # frame is identifiable
        rects, colours = [], []
        for r in range(2):
            for c in range(3):
                i = r * 3 + c
                x0 = 30 + c * 100
                y0 = 10 + r * 100
                rects.append((x0, x0 + 40, y0, y0 + 20 + 10 * i))
                colours.append((10 + i, 0, 0, 255))
        return grid(300, 200, rects, colours)

    def test_row_major_equal_size(self):
        frames = runs.split_grid(self.six(), 3, 2)
        self.assertEqual(len(frames), 6)
        self.assertEqual(len({f.size for f in frames}), 1)
        for i, f in enumerate(frames):
            box = f.getchannel('A').getbbox()
            self.assertEqual(f.getpixel(((box[0] + box[2]) // 2,
                                         (box[1] + box[3]) // 2))[0], 10 + i)
            self.assertEqual(box[3] - box[1], 20 + 10 * i)

    def test_n_by_one_matches_split_sheet(self):
        img = sheet(300, [(10, 50, 0, 50), (60, 100, 0, 50), (200, 240, 0, 50)])
        a = runs.split_grid(img, 3, 1)
        b = runs.split_sheet(img, 3)
        self.assertEqual([x.tobytes() for x in a], [x.tobytes() for x in b])
        self.assertEqual({x.size for x in a}, {(150, H)})

    def test_wrong_row_count(self):
        with self.assertRaises(SystemExit) as cm:
            runs.split_grid(self.six(), 3, 3)
        msg = str(cm.exception)
        self.assertIn('found 2', msg)
        self.assertIn('10-', msg)

    def test_wrong_column_count_in_one_row(self):
        img = self.six()
        img.paste((0, 0, 0, 0), (0, 100, 300, 200))
        img.paste(BLOB, (30, 110, 70, 150))
        img.paste(BLOB, (130, 110, 170, 150))
        with self.assertRaises(SystemExit) as cm:
            runs.split_grid(img, 3, 2)
        self.assertIn('row 2', str(cm.exception))

    def test_uneven_row_gaps_use_midpoints(self):
        # rows at y 10-40 and 100-190 -> boundary (40+100)//2 = 70
        img = grid(200, 200, [(20, 60, 10, 40), (120, 160, 10, 40),
                              (20, 60, 100, 190), (120, 160, 100, 190)])
        frames = runs.split_grid(img, 2, 2)
        # strips: 0-70 (h70) and 70-200 (h130) -> padded to 130
        self.assertEqual({f.size for f in frames}, {(110, 130)})
        top = frames[0].getchannel('A').getbbox()
        # 30-high blob at y 10 in a 70-high strip, padded by (130-70)//2 = 30
        self.assertEqual(top[1], 30 + 10)
        bottom = frames[2].getchannel('A').getbbox()
        self.assertEqual(bottom[1], 30)

    def test_row_specks_ignored(self):
        img = self.six()
        img.paste(BLOB, (30, 99, 40, 100))  # 1px tall speck between rows
        self.assertEqual(len(runs.split_grid(img, 3, 2)), 6)


class SheetCliTest(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, RUN_SCRIPT, *args],
                              capture_output=True, text=True)

    def test_end_to_end(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 'sheet.png')
            sheet(300, [(30, 70, 10, 90), (125, 175, 20, 90),
                        (220, 280, 10, 100)]).save(src)
            out = os.path.join(d, 'out')
            r = self.run_cli('--sheet', '3', src, '--out-dir', out, '--height', '64')
            self.assertEqual(r.returncode, 0, r.stderr)
            files = sorted(f for f in os.listdir(out) if f.startswith('run-'))
            self.assertEqual(files, ['run-0.png', 'run-1.png', 'run-2.png'])
            sizes = set()
            for f in files:
                with Image.open(os.path.join(out, f)) as im:
                    sizes.add(im.size)
            self.assertEqual(len(sizes), 1)
            self.assertEqual(sizes.pop()[1], 64)

    def test_end_to_end_grid(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 'sheet.png')
            rects = [(30 + c * 100, 70 + c * 100, 10 + r * 100, 90 + r * 100)
                     for r in range(2) for c in range(3)]
            grid(300, 200, rects).save(src)
            out = os.path.join(d, 'out')
            r = self.run_cli('--sheet', '3x2', src, '--out-dir', out, '--height', '64')
            self.assertEqual(r.returncode, 0, r.stderr)
            files = sorted(f for f in os.listdir(out) if f.startswith('run-'))
            self.assertEqual(files, [f'run-{i}.png' for i in range(6)])
            sizes = set()
            for f in files:
                with Image.open(os.path.join(out, f)) as im:
                    sizes.add(im.size)
            self.assertEqual(len(sizes), 1)
            self.assertEqual(sizes.pop()[1], 64)

    def test_bad_sheet_arg(self):
        r = self.run_cli('--sheet', '0x2', 'a.png')
        self.assertNotEqual(r.returncode, 0)
        r = self.run_cli('--sheet', 'foo', 'a.png')
        self.assertNotEqual(r.returncode, 0)

    def test_rejects_dummy_and_multiple_images(self):
        r = self.run_cli('--sheet', '2', '--dummy', '2', 'a.png')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('--dummy', r.stderr)
        r = self.run_cli('--sheet', '2', 'a.png', 'b.png')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('exactly one', r.stderr)

    def test_opaque_sheet_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 's.png')
            Image.new('RGBA', (100, 50), (255, 255, 255, 255)).save(src)
            r = self.run_cli('--sheet', '2', src, '--out-dir', os.path.join(d, 'o'))
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('transparent', r.stderr)


def add_noise(img, alpha=5, step=7):
    """Scatter faint low-alpha specks over the whole canvas (corners stay
    clear so require_transparency still passes)."""
    for y in range(2, img.height - 2, step):
        for x in range(2, img.width - 2, step):
            if img.getpixel((x, y))[3] == 0:
                img.putpixel((x, y), (255, 255, 255, alpha))
    return img


def faint_alphas(img):
    return [a for a in img.getchannel('A').getdata() if 0 < a <= ALPHA_NOISE_MAX]


class CleanAlphaTest(unittest.TestCase):
    def test_threshold(self):
        img = Image.new('RGBA', (3, 1))
        img.putpixel((0, 0), (9, 9, 9, ALPHA_NOISE_MAX))
        img.putpixel((1, 0), (9, 9, 9, ALPHA_NOISE_MAX + 1))
        img.putpixel((2, 0), (9, 9, 9, 255))
        out = clean_alpha(img)
        self.assertEqual(out.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(out.getpixel((1, 0)), (9, 9, 9, ALPHA_NOISE_MAX + 1))
        self.assertEqual(out.getpixel((2, 0)), (9, 9, 9, 255))
        self.assertEqual(img.getpixel((0, 0))[3], ALPHA_NOISE_MAX)


class NoisyCliTest(unittest.TestCase):
    def run_script(self, script, *args):
        return subprocess.run([sys.executable, script, *args],
                              capture_output=True, text=True)

    def test_obstacle_ignores_noise(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 'o.png')
            add_noise(sheet(200, [(80, 120, 20, 80)], height=150)).save(src)
            out = os.path.join(d, 'out.png')
            r = self.run_script(OBSTACLE_SCRIPT, src, '--out', out, '--height', '60')
            self.assertEqual(r.returncode, 0, r.stderr)
            with Image.open(out) as im:
                self.assertEqual(im.height, 60)
                self.assertEqual(im.width, 40)  # blob 40x60, scale 1
                self.assertEqual(faint_alphas(im), [])
                bottom = [im.getpixel((x, im.height - 1))[3] for x in range(im.width)]
                self.assertTrue(any(a == 255 for a in bottom))

    def test_obstacle_only_noise_exits(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 'o.png')
            add_noise(sheet(100, [], height=100)).save(src)
            r = self.run_script(OBSTACLE_SCRIPT, src, '--out', os.path.join(d, 'x.png'))
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('fully transparent', r.stderr)

    def test_run_sheet_ignores_noise(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 's.png')
            add_noise(sheet(300, [(30, 70, 10, 90), (130, 170, 10, 90),
                                  (230, 270, 10, 90)])).save(src)
            out = os.path.join(d, 'out')
            r = self.run_script(RUN_SCRIPT, '--sheet', '3', src,
                                '--out-dir', out, '--height', '80')
            self.assertEqual(r.returncode, 0, r.stderr)
            for i in range(3):
                with Image.open(os.path.join(out, f'run-{i}.png')) as im:
                    self.assertEqual(im.size, (40, 80))
                    self.assertEqual(faint_alphas(im), [])
                    self.assertEqual(im.getchannel('A').getbbox(), (0, 0, 40, 80))

    def test_run_sources_ignore_noise(self):
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for i, blob in enumerate([(20, 60, 10, 90), (30, 70, 10, 90)]):
                p = os.path.join(d, f'f{i}.png')
                add_noise(sheet(100, [blob])).save(p)
                paths.append(p)
            out = os.path.join(d, 'out')
            r = self.run_script(RUN_SCRIPT, *paths, '--out-dir', out, '--height', '80')
            self.assertEqual(r.returncode, 0, r.stderr)
            with Image.open(os.path.join(out, 'run-0.png')) as im:
                self.assertEqual(im.size, (50, 80))  # union x 20..70
                self.assertEqual(faint_alphas(im), [])

    def test_run_only_noise_exits(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'f.png')
            add_noise(sheet(100, [])).save(p)
            r = self.run_script(RUN_SCRIPT, p, '--out-dir', os.path.join(d, 'o'))
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('fully transparent', r.stderr)


class PaintLanesTest(unittest.TestCase):
    W, H = 1600, 540
    BG = (20, 30, 30)

    def painted(self):
        return scenery.paint_lanes(Image.new('RGB', (self.W, self.H), self.BG))

    def changed_rows(self, im, x):
        return [y for y in range(self.H) if im.getpixel((x, y)) != self.BG]

    def test_dividers_only_at_inner_row_boundaries(self):
        im = self.painted()
        x = (scenery.DASH_PERIOD - scenery.DASH_LEN) // 2  # first column of a dash
        rows = self.changed_rows(im, x)
        half = scenery.DASH_THICKNESS // 2
        expected = [y for b in (180, 360) for y in range(b - half, b + half)]
        self.assertEqual(rows, expected)  # nothing at the top/bottom edge

    def test_gap_is_untouched(self):
        self.assertEqual(self.changed_rows(self.painted(), 0), [])

    def test_seam_holds(self):
        im = self.painted()
        self.assertEqual(scenery.seam_delta(im), 0)
        self.assertEqual(self.W % scenery.DASH_PERIOD, 0)


class FadeHorizonTest(unittest.TestCase):
    BG, ROAD = (16, 15, 16), (26, 30, 46)

    def faded(self):
        return scenery.fade_horizon(Image.new('RGB', (40, 360), self.BG), self.ROAD)

    def test_last_row_is_road_colour(self):
        self.assertEqual(self.faded().getpixel((5, 359)), self.ROAD)

    def test_above_band_untouched(self):
        im = self.faded()
        self.assertEqual(im.getpixel((5, 359 - scenery.HORIZON_BAND)), self.BG)
        self.assertEqual(im.getpixel((5, 0)), self.BG)

    def test_band_ramps_monotonically(self):
        im = self.faded()
        blues = [im.getpixel((5, y))[2] for y in range(360 - scenery.HORIZON_BAND, 360)]
        self.assertEqual(blues, sorted(blues))

    def test_parse_hex_forms(self):
        for t in ('0x1a1e2e', '#1A1E2E', '1a1e2e'):
            self.assertEqual(scenery.parse_hex(t), (26, 30, 46))
        for bad in ('0x1a1e', 'zzzzzz', ''):
            with self.assertRaises(Exception):
                scenery.parse_hex(bad)


class SceneryCliTest(unittest.TestCase):
    def run_script(self, *args):
        return subprocess.run([sys.executable, SCENERY_SCRIPT, *args],
                              capture_output=True, text=True)

    def test_road_lanes_end_to_end(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = os.path.join(d, 's.png'), os.path.join(d, 'o.png')
            Image.new('RGB', (1536, 512), (20, 30, 30)).save(src)
            r = self.run_script('road', src, '--lanes', '--out', out)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('painted 2 lane dividers', r.stdout)
            with Image.open(out) as im:
                self.assertEqual(im.size, (1600, 540))
                self.assertNotEqual(im.getpixel((50, 180)), (20, 30, 30))

    def test_scenery_horizon_end_to_end(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = os.path.join(d, 's.png'), os.path.join(d, 'o.png')
            Image.new('RGB', (1536, 512), (16, 15, 16)).save(src)
            r = self.run_script('scenery', src, '--horizon', '0x1a1e2e', '--out', out)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('bottom row 0x1a1e2e', r.stdout)

    def test_horizon_rejected_for_road(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 's.png')
            Image.new('RGB', (1536, 512)).save(src)
            r = self.run_script('road', src, '--horizon', '0x1a1e2e', '--out', os.path.join(d, 'o.png'))
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('--horizon only applies to the scenery', r.stderr)

    def test_lanes_rejected_for_scenery(self):
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, 's.png')
            Image.new('RGB', (1536, 512)).save(src)
            r = self.run_script('scenery', src, '--lanes', '--out', os.path.join(d, 'o.png'))
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('--lanes only applies to the road', r.stderr)


if __name__ == '__main__':
    unittest.main()
