import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wallX, wallShake, runnerSpan, wallGap, gapStubs, debrisPiece, debrisPieces, crackLines, crackAlpha, debrisState, dustPuffs, dustState, DUST_MAX_DELAY_MS,
} from '../src/wallBreak.js';
import { sectionAt } from '../src/config/sections.js';
import { snapToTrackBeat } from '../src/Conductor.js';
import {
  PLAYER_X, GAME_WIDTH, NUM_ROWS, OBSTACLE_TIMING_SPEED, OBSTACLE_TIMING_SWITCH_MS, PLAYER_HH, PLAYER_SPRITE_HH,
  WALL_BREAK_MS, WALL_IMPACT_X, WALL_SHAKE_MS, WALL_SHAKE_PX, WALL_DEBRIS_COUNT, WALL_DEBRIS_LIFE_MS,
  WALL_DEBRIS_FADE_MS, WALL_DUST_COUNT, WALL_DUST_LIFE_MS, WALL_DUST_ALPHA,
  WALL_CRACK_MS, WALL_CRACK_COUNT, WALL_CRACK_SEGMENTS, WALL_CRACK_SEGMENT_PX,
  WALL_LINE_WIDTH, WALL_LINE_TOP, WALL_GAP_PAD_TOP, WALL_GAP_PAD_BOTTOM, WALL_DEBRIS_COLORS, GAME_HEIGHT,
} from '../src/config/gameConfig.js';
import { rowLayout } from '../src/rowLayout.js';

const approachMs = ((GAME_WIDTH - wallX(WALL_BREAK_MS)) / OBSTACLE_TIMING_SPEED) * 1000;

test('WALL_BREAK_MS sits on a real track beat, after obstacle timing switches to the band speed', () => {
  assert.ok(Math.abs(snapToTrackBeat(WALL_BREAK_MS) - WALL_BREAK_MS) <= 1);
  assert.ok(WALL_BREAK_MS - approachMs > OBSTACLE_TIMING_SWITCH_MS);
});

test('wallX: the left face reaches the runner exactly at WALL_BREAK_MS', () => {
  assert.equal(wallX(WALL_BREAK_MS), PLAYER_X + WALL_IMPACT_X);
});

test('wallX: approaches from the right at OBSTACLE_TIMING_SPEED', () => {
  assert.ok(Math.abs(wallX(WALL_BREAK_MS - 1000) - (PLAYER_X + WALL_IMPACT_X + OBSTACLE_TIMING_SPEED)) < 1e-9);
  assert.ok(wallX(WALL_BREAK_MS - approachMs - 1) > GAME_WIDTH);
  assert.ok(wallX(WALL_BREAK_MS - 1) > wallX(WALL_BREAK_MS));
});

test('wallX assumes speedMult 1: no section during the approach changes the world speed', () => {
  for (let ms = WALL_BREAK_MS - approachMs; ms <= WALL_BREAK_MS; ms += 20) {
    assert.equal(sectionAt(ms).speedMult, 1, `speedMult at ${ms}`);
  }
});

test('wallShake: still before the impact and from WALL_SHAKE_MS on', () => {
  for (const ms of [0, WALL_BREAK_MS - 1, WALL_BREAK_MS + WALL_SHAKE_MS, WALL_BREAK_MS + 10_000]) {
    assert.deepEqual(wallShake(ms), { x: 0, y: 0 }, `at ${ms}`);
  }
});

test('wallShake: bounded by the decaying amplitude, deterministic, and actually shakes', () => {
  let moved = false;
  for (let e = 0; e < WALL_SHAKE_MS; e += 5) {
    const { x, y } = wallShake(WALL_BREAK_MS + e);
    const amp = WALL_SHAKE_PX * (1 - e / WALL_SHAKE_MS);
    assert.ok(Math.abs(x) <= amp + 1e-9 && Math.abs(y) <= amp + 1e-9, `at +${e}`);
    if (Math.abs(x) > 1 || Math.abs(y) > 1) moved = true;
    assert.deepEqual(wallShake(WALL_BREAK_MS + e), { x, y });
  }
  assert.ok(moved);
});

const feetOf = row => rowLayout(row).y + PLAYER_HH * rowLayout(row).scale;
const headOf = row => feetOf(row) - PLAYER_SPRITE_HH * 2 * rowLayout(row).scale;

test('runnerSpan: matches the runner sprite on each row (feet at the hitbox bottom, head a sprite height up)', () => {
  for (let row = 0; row < NUM_ROWS; row++) {
    const { feet, head, scale } = runnerSpan(row);
    assert.equal(feet, feetOf(row));
    assert.equal(head, headOf(row));
    assert.equal(scale, rowLayout(row).scale);
  }
});

test('wallGap: spans the runner head to feet on its row, padded', () => {
  for (let row = 0; row < NUM_ROWS; row++) {
    const { top, bottom } = wallGap(row);
    assert.equal(top, headOf(row) - WALL_GAP_PAD_TOP);
    assert.equal(bottom, feetOf(row) + WALL_GAP_PAD_BOTTOM);
    assert.ok(top > WALL_LINE_TOP, 'line still stands above the gap');
  }
  // the front row's feet sit at the screen bottom, so its gap runs off-screen (no line left below)
  assert.ok(wallGap(0).bottom < GAME_HEIGHT && wallGap(1).bottom < GAME_HEIGHT);
  assert.ok(wallGap(0).top < wallGap(1).top && wallGap(1).top < wallGap(2).top);
});

test('gapStubs: deterministic triangles at both ends of the gap, near the line, teeth reaching into the gap', () => {
  for (let row = 0; row < NUM_ROWS; row++) {
    const { top, bottom } = wallGap(row);
    const stubs = gapStubs(row);
    assert.deepEqual(gapStubs(row), stubs);
    assert.ok(stubs.length >= 4);
    let atTop = 0;
    let atBottom = 0;
    let intoGap = 0;
    for (const tri of stubs) {
      assert.equal(tri.length, 6);
      const xs = [tri[0], tri[2], tri[4]];
      const ys = [tri[1], tri[3], tri[5]];
      assert.ok(xs.every(x => x >= -8 && x <= WALL_LINE_WIDTH + 8), `x near the line: ${xs}`);
      const nearTop = ys.every(y => Math.abs(y - top) <= 30);
      const nearBottom = ys.every(y => Math.abs(y - bottom) <= 30);
      assert.ok(nearTop !== nearBottom, `stub at exactly one end: ${ys}`);
      if (nearTop) { atTop++; if (Math.max(...ys) > top) intoGap++; }
      else { atBottom++; if (Math.min(...ys) < bottom) intoGap++; }
    }
    assert.equal(atTop, atBottom);
    assert.ok(intoGap >= 6, 'jagged teeth reach into the gap at both ends');
  }
});

test('debris: deterministic, one set per row, size and colour independent of the row', () => {
  assert.equal(debrisPieces(0).length, WALL_DEBRIS_COUNT);
  assert.deepEqual(debrisPiece(5, 2), debrisPiece(5, 2));
  for (let i = 0; i < WALL_DEBRIS_COUNT; i++) {
    const [a, b] = [debrisPiece(i, 0), debrisPiece(i, 2)];
    assert.equal(a.w, b.w);
    assert.equal(a.h, b.h);
    assert.equal(a.color, b.color);
  }
});

test('debris starts inside the runner span at the line and flies forward and up', () => {
  for (let row = 0; row < NUM_ROWS; row++) {
    for (const p of debrisPieces(row)) {
      assert.ok(p.y0 >= headOf(row) && p.y0 <= feetOf(row));
      assert.ok(Math.abs(p.x0 - WALL_LINE_WIDTH) < 20, 'starts at the line');
      assert.ok(WALL_DEBRIS_COLORS.includes(p.color));
      assert.ok(p.vx > 0 && p.vy < 0);
      assert.ok(p.floorY > p.y0);
      const s0 = debrisState(p, 0);
      assert.ok(Math.abs(s0.x - p.x0) < 1e-9 && Math.abs(s0.y - p.y0) < 1e-9);
      assert.equal(s0.alpha, 1);
      const s = debrisState(p, 40);
      assert.ok(s.x > p.x0 && s.y < p.y0, 'moves forward and up at first');
    }
  }
});

test('debris lands on its floorY and lies still there as rubble, then fades out', () => {
  for (const p of debrisPieces(1)) {
    const late = debrisState(p, WALL_DEBRIS_LIFE_MS - WALL_DEBRIS_FADE_MS - 1);
    const later = debrisState(p, WALL_DEBRIS_LIFE_MS - 100);
    assert.equal(late.y, p.floorY);
    assert.deepEqual([later.x, later.y, later.angle], [late.x, late.y, late.angle]);
    assert.equal(late.alpha, 1);
    assert.ok(later.alpha > 0 && later.alpha < 1);
    for (let t = 0; t < WALL_DEBRIS_LIFE_MS; t += 10) assert.ok(debrisState(p, t).y <= p.floorY + 1e-9);
  }
});

test('debris is absent outside its life', () => {
  const p = debrisPiece(0, 1);
  assert.equal(debrisState(p, -1), null);
  assert.equal(debrisState(p, WALL_DEBRIS_LIFE_MS), null);
});

test('dust: swells and drifts forward, alpha within (0, WALL_DUST_ALPHA], gone after its life', () => {
  const puffs = dustPuffs(2);
  assert.equal(puffs.length, WALL_DUST_COUNT);
  for (const p of puffs) {
    assert.ok(p.delay >= 0 && p.delay <= DUST_MAX_DELAY_MS);
    assert.equal(dustState(p, p.delay - 1), null);
    assert.equal(dustState(p, p.delay + WALL_DUST_LIFE_MS), null);
    const a = dustState(p, p.delay + 100);
    const b = dustState(p, p.delay + 600);
    assert.ok(b.scale > a.scale && b.x > a.x && b.y <= a.y);
    for (let t = 0; t < WALL_DUST_LIFE_MS; t += 25) {
      const s = dustState(p, p.delay + t);
      assert.ok(s.alpha >= 0 && s.alpha <= WALL_DUST_ALPHA);
    }
  }
});

test('crackLines: deterministic, right counts, all anchored at the line at chest height', () => {
  for (let row = 0; row < NUM_ROWS; row++) {
    const lines = crackLines(row);
    assert.deepEqual(lines, crackLines(row));
    assert.equal(lines.length, WALL_CRACK_COUNT);
    const { head, feet } = runnerSpan(row);
    for (const { pts } of lines) {
      assert.equal(pts.length, (WALL_CRACK_SEGMENTS + 1) * 2);
      assert.equal(pts[0], WALL_LINE_WIDTH / 2);
      assert.ok(Math.abs(pts[1] - (head + feet) / 2) < 1e-9);
      for (let i = 2; i < pts.length; i += 2) {
        assert.ok(Math.abs(Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]) - WALL_CRACK_SEGMENT_PX) < 1e-9);
      }
    }
  }
  assert.equal(new Set(crackLines(1).map(l => l.color)).size, 2);
});

test('crackAlpha: 0 outside the window, full at impact, then non-increasing to 0', () => {
  assert.equal(crackAlpha(-1), 0);
  assert.equal(crackAlpha(WALL_CRACK_MS), 0);
  assert.equal(crackAlpha(0), 1);
  let prev = 1;
  for (let t = 0; t < WALL_CRACK_MS; t += 5) {
    const a = crackAlpha(t);
    assert.ok(a <= prev && a > 0);
    prev = a;
  }
  assert.ok(crackAlpha(WALL_CRACK_MS - 1) < 0.1);
});
