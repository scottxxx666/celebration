import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVES } from '../src/config/waves.js';
import { WAVES_HARD } from '../src/config/wavesHard.js';
import { SECTIONS } from '../src/config/sections.js';
import { TRACK_BEAT_MS, WIN_MS } from '../src/config/gameConfig.js';

const lastArrival = waves => Math.max(
  ...waves.flatMap(wave => wave.obstacles.map(o => wave.songTime + o.timeOffset * TRACK_BEAT_MS)),
);

// WIN_MS is hand-tuned against waves.js, which is regenerated (and the frozen
// wavesHard.js): a win before the last obstacle arrives would silently cut
// authored obstacles from the run.
for (const [name, waves] of [['WAVES', WAVES], ['WAVES_HARD', WAVES_HARD]]) {
  test(`the run is not cleared before the last ${name} obstacle arrives`, () => {
    const lastArrivalMs = lastArrival(waves);
    assert.ok(WIN_MS > lastArrivalMs, `WIN_MS ${WIN_MS} <= last arrival ${lastArrivalMs}`);
  });
}

test('the run is not cleared in the middle of a section effect', () => {
  const lastSectionEndMs = Math.max(...SECTIONS.map(section => section.endMs));
  assert.ok(WIN_MS >= lastSectionEndMs, `WIN_MS ${WIN_MS} < last section end ${lastSectionEndMs}`);
});
