import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostFade, ghostOffset } from '../src/ghostWorld.js';
import { GHOST_FADE_MS, GHOST_OFFSET_X, GHOST_OFFSET_Y } from '../src/config/gameConfig.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

const section = { ghost: true, startMs: 10000, endMs: 20000 };

test('a non-ghost section has no fade anywhere', () => {
  assert.equal(ghostFade({ ghost: false, startMs: 0, endMs: 10000 }, 5000), 0);
});

test('fade ramps in from the section start', () => {
  assert.equal(ghostFade(section, 10000), 0);
  near(ghostFade(section, 10000 + GHOST_FADE_MS / 2), 0.5);
  assert.equal(ghostFade(section, 10000 + GHOST_FADE_MS), 1);
});

test('fade holds at 1 in the middle', () => {
  assert.equal(ghostFade(section, 15000), 1);
});

test('fade ramps out over the last GHOST_FADE_MS and is 0 at/after the end', () => {
  near(ghostFade(section, 20000 - GHOST_FADE_MS / 2), 0.5);
  assert.equal(ghostFade(section, 20000), 0);
  assert.equal(ghostFade(section, 25000), 0);
});

test('a section shorter than two ramps never exceeds the smaller ramp', () => {
  const short = { ghost: true, startMs: 0, endMs: GHOST_FADE_MS };
  for (let t = 0; t <= short.endMs; t += 10) {
    const limit = Math.min(t, short.endMs - t) / GHOST_FADE_MS;
    assert.ok(ghostFade(short, t) <= limit + 1e-9, `t=${t}`);
  }
  near(ghostFade(short, GHOST_FADE_MS / 2), 0.5);
});

test('ghosts are evenly spaced in angle around the orbit', () => {
  const count = 3;
  const angles = [0, 1, 2].map(i => {
    const o = ghostOffset(i, count, 0.1);
    return Math.atan2(o.y / GHOST_OFFSET_Y, o.x / GHOST_OFFSET_X);
  });
  near((angles[1] - angles[0] + 2 * Math.PI) % (2 * Math.PI), (2 * Math.PI) / count);
  near((angles[2] - angles[1] + 2 * Math.PI) % (2 * Math.PI), (2 * Math.PI) / count);
});

test('phase 0 and phase 1 give the same offset', () => {
  const a = ghostOffset(1, 2, 0);
  const b = ghostOffset(1, 2, 1);
  near(a.x, b.x);
  near(a.y, b.y);
  assert.equal(a.zoom, b.zoom);
});

test('offsets stay within the configured radii', () => {
  for (let phase = 0; phase <= 1; phase += 0.05) {
    for (let i = 0; i < 2; i++) {
      const o = ghostOffset(i, 2, phase);
      assert.ok(Math.abs(o.x) <= GHOST_OFFSET_X + 1e-9);
      assert.ok(Math.abs(o.y) <= GHOST_OFFSET_Y + 1e-9);
    }
  }
});

test('zoom grows with the ghost index', () => {
  assert.ok(ghostOffset(0, 3, 0).zoom > 0);
  assert.ok(ghostOffset(1, 3, 0).zoom > ghostOffset(0, 3, 0).zoom);
  assert.ok(ghostOffset(2, 3, 0).zoom > ghostOffset(1, 3, 0).zoom);
});
