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

from prep_common import require_transparency  # noqa: E402


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


runs = load('prep_run_frames', 'prep-run-frames.py')
RUN_SCRIPT = os.path.join(TOOLS, 'prep-run-frames.py')

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


if __name__ == '__main__':
    unittest.main()
