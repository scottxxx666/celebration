import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conductor } from '../src/Conductor.js';
import { AUDIO_LATENCY_OFFSET_MS, BEAT_MS, FIRST_BEAT_OFFSET_MS } from '../src/config/gameConfig.js';

// Fake Phaser sound: `context` is the AudioContext stand-in (omit for the
// HTML5 / no-audio managers, which have none).
const fakeMusic = (seekSec, context) => ({ seek: seekSec, manager: context ? { context } : {} });

// Trim pinned to 0 so detection is tested independently of the config value
function songMsFor(context, trimMs = 0) {
  const conductor = new Conductor(fakeMusic(10, context), trimMs);
  conductor.update();
  return conductor;
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !== ${expected}`);

test('no manager or no context reads as zero latency', () => {
  const noManager = new Conductor({ seek: 10 }, 0);
  noManager.update();
  assert.equal(noManager.latencyMs, 0);
  assert.equal(noManager.songMs, 10000);

  const noContext = songMsFor(undefined);
  assert.equal(noContext.latencyMs, 0);
  assert.equal(noContext.songMs, 10000);
});

test('baseLatency alone is used when outputLatency is unusable', () => {
  for (const outputLatency of [undefined, NaN, -0.05, Infinity, '0.05']) {
    const conductor = songMsFor({ baseLatency: 0.005, outputLatency });
    near(conductor.latencyMs, 5);
    near(conductor.songMs, 9995);
  }
});

test('outputLatency alone is used when baseLatency is unusable', () => {
  for (const baseLatency of [undefined, NaN, -0.01]) {
    near(songMsFor({ baseLatency, outputLatency: 0.04 }).latencyMs, 40);
  }
});

test('baseLatency and outputLatency add up', () => {
  const conductor = songMsFor({ baseLatency: 0.005, outputLatency: 0.04 });
  near(conductor.latencyMs, 45);
  near(conductor.songMs, 9955);
});

test('the manual trim adds on top of the detected latency', () => {
  const later = songMsFor({ baseLatency: 0.005, outputLatency: 0.04 }, 30);
  near(later.latencyMs, 75);
  near(later.songMs, 9925);

  const earlier = songMsFor({ baseLatency: 0.005, outputLatency: 0.04 }, -60);
  near(earlier.latencyMs, -15);
  near(earlier.songMs, 10015);

  const trimOnly = songMsFor(undefined, 30);
  assert.equal(trimOnly.latencyMs, 30);
  assert.equal(trimOnly.songMs, 9970);
});

test('the trim defaults to AUDIO_LATENCY_OFFSET_MS', () => {
  const conductor = new Conductor(fakeMusic(10));
  conductor.update();
  assert.equal(conductor.latencyMs, AUDIO_LATENCY_OFFSET_MS);
});

test('hysteresis: first reading adopted, small change ignored, large change adopted', () => {
  const context = { baseLatency: 0, outputLatency: 0.02 };
  const conductor = new Conductor(fakeMusic(10, context), 5);

  conductor.update();
  near(conductor.latencyMs, 25);

  // Wobble within the threshold, in both directions, keeps the adopted value
  context.outputLatency = 0.029;
  conductor.update();
  near(conductor.latencyMs, 25);
  near(conductor.songMs, 9975);
  context.outputLatency = 0.011;
  conductor.update();
  near(conductor.latencyMs, 25);

  // Device switch (e.g. Bluetooth): well past the threshold
  context.outputLatency = 0.18;
  conductor.update();
  near(conductor.latencyMs, 185);
  near(conductor.songMs, 9815);

  // The threshold is measured from the adopted value, not the last reading
  context.outputLatency = 0.171;
  conductor.update();
  near(conductor.latencyMs, 185);
  context.outputLatency = 0.02;
  conductor.update();
  near(conductor.latencyMs, 25);
});

test('hysteresis: a first reading of zero is adopted, then replaced once the estimate arrives', () => {
  const context = { baseLatency: 0, outputLatency: 0 };
  const conductor = new Conductor(fakeMusic(10, context), 0);
  conductor.update();
  assert.equal(conductor.latencyMs, 0);
  context.outputLatency = 0.05;
  conductor.update();
  near(conductor.latencyMs, 50);
});

test('song time is slightly negative at the start of a run and fires no crossings', () => {
  const conductor = new Conductor(fakeMusic(0, { baseLatency: 0, outputLatency: 0.05 }), 0);
  conductor.update();
  near(conductor.songMs, -50);
  assert.equal(conductor.beatCrossed, false);
  assert.equal(conductor.beatIndex, -1);
});

test('beat indices and crossings come from the latency-shifted time', () => {
  const latencySec = 0.1;
  const music = fakeMusic(0, { baseLatency: 0, outputLatency: latencySec });
  const conductor = new Conductor(music, 0);
  const beat = (n) => (FIRST_BEAT_OFFSET_MS + n * BEAT_MS) / 1000; // scheduled time of game beat n

  // Scheduled time is on beat 0, but it isn't heard yet
  music.seek = beat(0) + 0.05;
  conductor.update();
  assert.ok(conductor.beatTimeMs < 0);
  assert.equal(conductor.beatIndex, -1);
  assert.equal(conductor.beatCrossed, false);

  // Heard position reaches beat 0
  music.seek = beat(0) + latencySec + 0.001;
  conductor.update();
  assert.equal(conductor.beatIndex, 0);
  assert.equal(conductor.halfBeatIndex, 0);
  assert.equal(conductor.beatCrossed, true);
  assert.equal(conductor.halfBeatCrossed, true);

  // Scheduled time passes beat 3; the heard position is still in beat 2
  music.seek = beat(3) + 0.05;
  conductor.update();
  assert.equal(conductor.beatIndex, 2);
  assert.equal(conductor.halfBeatIndex, 5);
  assert.equal(conductor.gridIndex(1), 2);
  near(conductor.phaseMs(1), BEAT_MS - 50);

  music.seek = beat(3) + latencySec + 0.001;
  conductor.update();
  assert.equal(conductor.beatIndex, 3);
  assert.equal(conductor.beatCrossed, true);

  // Same beat next frame: no crossing
  music.seek += 0.016;
  conductor.update();
  assert.equal(conductor.beatCrossed, false);
});
