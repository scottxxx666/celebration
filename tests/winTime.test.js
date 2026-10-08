import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVES } from '../src/config/waves.js';
import { SECTIONS } from '../src/config/sections.js';
import { TRACK_BEAT_MS, WIN_MS } from '../src/config/gameConfig.js';

const lastArrivalMs = Math.max(
  ...WAVES.flatMap(wave => wave.obstacles.map(o => wave.songTime + o.timeOffset * TRACK_BEAT_MS)),
);

// WIN_MS is hand-tuned against waves.js, which is regenerated: a win before the
// last obstacle arrives would silently cut authored obstacles from the run.
test('the run is not cleared before the last obstacle arrives', () => {
  assert.ok(WIN_MS > lastArrivalMs, `WIN_MS ${WIN_MS} <= last arrival ${lastArrivalMs}`);
});

test('the run is not cleared in the middle of a section effect', () => {
  const lastSectionEndMs = Math.max(...SECTIONS.map(section => section.endMs));
  assert.ok(WIN_MS >= lastSectionEndMs, `WIN_MS ${WIN_MS} < last section end ${lastSectionEndMs}`);
});
