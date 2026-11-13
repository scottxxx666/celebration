import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inWallClearWindow } from '../src/wallBreak.js';
import { obstacleArrivalMs } from '../src/objects/ObstacleSpawner.js';
import { WAVES } from '../src/config/waves.js';
import { WAVES_HARD } from '../src/config/wavesHard.js';
import { WALL_BREAK_MS, WALL_CLEAR_BEATS, TRACK_BEAT_MS } from '../src/config/gameConfig.js';

const windowEndMs = WALL_BREAK_MS + WALL_CLEAR_BEATS * TRACK_BEAT_MS;

test('inWallClearWindow: arrivals at and just after the break are unfair', () => {
  assert.ok(inWallClearWindow(WALL_BREAK_MS));
  assert.ok(inWallClearWindow(WALL_BREAK_MS - 0.5), 'a beat-grid arrival rounded to just before the break still counts');
  assert.ok(inWallClearWindow(WALL_BREAK_MS + TRACK_BEAT_MS));
  assert.ok(inWallClearWindow(windowEndMs - 2));
});

test('inWallClearWindow: arrivals before the break, or from WALL_CLEAR_BEATS after it, are fine', () => {
  assert.ok(!inWallClearWindow(WALL_BREAK_MS - TRACK_BEAT_MS / 2), 'arrives before the break: left of the wall, visible');
  assert.ok(!inWallClearWindow(WALL_BREAK_MS - 2));
  assert.ok(!inWallClearWindow(windowEndMs), 'exactly WALL_CLEAR_BEATS after the break');
  assert.ok(!inWallClearWindow(windowEndMs - 0.5), 'a beat-grid arrival rounded to just before the window end');
  assert.ok(!inWallClearWindow(windowEndMs + TRACK_BEAT_MS));
});

// StationBuilding hides everything right of the wall until the break, so an obstacle arriving just after it
// would only be revealed a few hundred px ahead of the runner.
for (const [name, waves] of [['WAVES', WAVES], ['WAVES_HARD', WAVES_HARD]]) {
  test(`no ${name} obstacle arrives within WALL_CLEAR_BEATS after the wall break`, () => {
    const hidden = waves.flatMap(wave => wave.obstacles
      .filter(obs => inWallClearWindow(obstacleArrivalMs(wave, obs)))
      .map(obs => `${wave.name} +${obs.timeOffset} row ${obs.row}`));
    assert.deepEqual(hidden, []);
  });
}
