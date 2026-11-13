import os
import re
import unittest

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCALE = 2  # the shipped image is authored at 2x logical size


def const(path, name):
    with open(os.path.join(ROOT, path)) as f:
        return int(re.search(r'export const ' + name + r'\s*=\s*(-?\d+)', f.read()).group(1))


class StationBuildingImageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = os.path.join(ROOT, 'public', 'assets', 'station-building.png')
        cls.w = const('src/config/gameConfig.js', 'STATION_WIDTH')
        bottom = const('src/config/gameConfig.js', 'GAME_HEIGHT') + const('src/wallBreak.js', 'WALL_OFFSCREEN_PAD')
        cls.h = bottom - const('src/config/gameConfig.js', 'WALL_LINE_TOP')

    def test_exists(self):
        self.assertTrue(os.path.exists(self.path))

    def test_size_matches_station_box_at_2x(self):
        im = Image.open(self.path)
        self.assertEqual(im.size, (self.w * SCALE, self.h * SCALE))

    def test_file_size_sane(self):
        self.assertLess(os.path.getsize(self.path), 2 * 1024 * 1024)

    def test_doorway_is_dark_and_plinth_reaches_bottom(self):
        im = Image.open(self.path).convert('L')
        door_x = const('src/config/gameConfig.js', 'STATION_DOOR_X') * SCALE
        door_w = const('src/config/gameConfig.js', 'STATION_DOOR_W') * SCALE
        door_top = (const('src/config/gameConfig.js', 'STATION_DOOR_TOP') - const('src/config/gameConfig.js', 'WALL_LINE_TOP')) * SCALE
        px = im.load()
        xs = range(door_x + door_w // 4, door_x + 3 * door_w // 4, 4)
        ys = range(door_top + 10, door_top + 60, 4)
        mean = sum(px[x, y] for x in xs for y in ys) / (len(xs) * len(ys))
        self.assertLess(mean, 40, 'the doorway interior stays near-black')
        self.assertGreater(sum(px[x, im.height - 1] for x in range(0, im.width, 8)), 0)


if __name__ == '__main__':
    unittest.main()
