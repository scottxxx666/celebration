import copy
import importlib.util
import os
import sys
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# clear_after_wall is plain maths; stub the audio deps so the module loads without librosa/numpy
for name in ('librosa', 'numpy'):
    sys.modules.setdefault(name, types.ModuleType(name))
spec = importlib.util.spec_from_file_location('gen_waves', os.path.join(ROOT, 'tools', 'gen-waves.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SONG_TIME = 53156  # verse2: real beat 132; the break (59134) is its beat offset 15


def wave(*obstacles, name='verse2', song_time=SONG_TIME):
    return {'songTime': song_time, 'name': name, 'duration': 12754,
            'obstacles': [{'timeOffset': t, 'row': r} for t, r in obstacles]}


def offsets(w):
    return [(o['timeOffset'], o['row']) for o in w['obstacles']]


class ClearAfterWallTest(unittest.TestCase):
    def test_window_bounds(self):
        brk = mod.WALL_BREAK_MS
        self.assertTrue(mod.in_wall_clear_window(brk))
        self.assertTrue(mod.in_wall_clear_window(brk + mod.BEAT_MS))
        self.assertFalse(mod.in_wall_clear_window(brk - mod.BEAT_MS / 2))
        self.assertFalse(mod.in_wall_clear_window(brk + mod.WALL_CLEAR_BEATS * mod.BEAT_MS))

    def test_untouched_when_nothing_in_window(self):
        waves = [wave((13, 0), (13, 2), (17, 1), (19, 0))]
        before = copy.deepcopy(waves)
        self.assertEqual(mod.clear_after_wall(waves), [])
        self.assertEqual(waves, before)

    def test_pair_moves_past_window_when_spacing_allows(self):
        waves = [wave((13, 0), (13, 2), (16, 1), (16, 2), (19, 0))]
        mod.clear_after_wall(waves)
        self.assertEqual(offsets(waves[0]), [(13, 0), (13, 2), (17, 1), (17, 2), (19, 0)])

    def test_dropped_when_moving_would_crowd_the_next_obstacle(self):
        # The committed chart's case: +16 pair, next obstacle at +18 — +17 would be one beat from it
        waves = [wave((13, 0), (13, 2), (16, 1), (16, 2), (18, 0))]
        changes = mod.clear_after_wall(waves)
        self.assertEqual(offsets(waves[0]), [(13, 0), (13, 2), (18, 0)])
        self.assertEqual(changes, ['verse2 +16 -> dropped'])

    def test_checks_spacing_across_waves(self):
        nxt = wave((0, 1), name='next', song_time=round(mod.beat_ms(150)))  # starts at +18 of verse2
        waves = [wave((16, 2)), nxt]
        mod.clear_after_wall(waves)
        self.assertEqual(offsets(waves[0]), [])
        self.assertEqual(offsets(waves[1]), [(0, 1)])

    def test_result_has_nothing_in_window(self):
        waves = [wave((15, 0), (16, 1), (21, 2))]
        mod.clear_after_wall(waves)
        for w in waves:
            for o in w['obstacles']:
                self.assertFalse(mod.in_wall_clear_window(w['songTime'] + o['timeOffset'] * mod.BEAT_MS))


if __name__ == '__main__':
    unittest.main()
