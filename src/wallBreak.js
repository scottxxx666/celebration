import {
  PLAYER_X, PLAYER_HH, PLAYER_SPRITE_HH, OBSTACLE_TIMING_SPEED,
  WALL_BREAK_MS, WALL_IMPACT_X, WALL_LINE_WIDTH, WALL_GAP_PAD_TOP, WALL_GAP_PAD_BOTTOM,
  WALL_SHAKE_PX, WALL_SHAKE_MS, WALL_SHAKE_REROLL_MS,
  WALL_DEBRIS_COUNT, WALL_DEBRIS_SPEED_MIN, WALL_DEBRIS_SPEED_MAX, WALL_DEBRIS_LIFT_MIN, WALL_DEBRIS_LIFT_MAX,
  WALL_DEBRIS_DRAG, WALL_DEBRIS_GRAVITY, WALL_DEBRIS_SPIN, WALL_DEBRIS_LIFE_MS, WALL_DEBRIS_FADE_MS, WALL_DEBRIS_COLORS,
  WALL_DUST_COUNT, WALL_DUST_ALPHA, WALL_DUST_LIFE_MS,
  WALL_CRACK_MS, WALL_CRACK_FADE_MS, WALL_CRACK_COUNT, WALL_CRACK_SEGMENTS, WALL_CRACK_SEGMENT_PX,
  WALL_CRACK_LIGHT_COLOR, WALL_LINE_COLOR,
} from './config/gameConfig.js';
import { rowLayout } from './rowLayout.js';
import { rand } from './cameraDance.js';

const STILL = Object.freeze({ x: 0, y: 0 });
export const DUST_MAX_DELAY_MS = 120; // puffs start staggered by up to this much after the impact
const between = (seed, min, max) => min + rand(seed) * (max - min);

// Screen x of the line's left edge while it approaches: derived from song time so it meets the runner
// exactly at WALL_BREAK_MS (and `?t=` seeks just work). It scrolls at OBSTACLE_TIMING_SPEED, the speed
// obstacle arrival timing assumes after OBSTACLE_TIMING_SWITCH_MS, with speedMult 1 (no section in the
// approach changes it; tests/wallBreak.test.js checks). Keeps going linearly past the impact; WallBreak
// only uses that for the first broken frame, then follows the road's actual scroll.
export function wallX(songMs) {
  return PLAYER_X + WALL_IMPACT_X + ((WALL_BREAK_MS - songMs) * OBSTACLE_TIMING_SPEED) / 1000;
}

// Camera scroll offset from the impact: a random jolt of up to WALL_SHAKE_PX per axis, re-rolled every
// WALL_SHAKE_REROLL_MS and shrinking linearly to nothing over WALL_SHAKE_MS. Stateless from song time.
export function wallShake(songMs) {
  const elapsed = songMs - WALL_BREAK_MS;
  if (elapsed < 0 || elapsed >= WALL_SHAKE_MS) return STILL;
  const amp = WALL_SHAKE_PX * (1 - elapsed / WALL_SHAKE_MS);
  const roll = WALL_BREAK_MS + Math.floor(elapsed / WALL_SHAKE_REROLL_MS) * 2;
  return { x: (rand(roll + 0.25) * 2 - 1) * amp, y: (rand(roll + 1.25) * 2 - 1) * amp };
}

// Feet line and head top of the runner on `row` (same maths as RunCycle.layout).
export function runnerSpan(row) {
  const { y, scale } = rowLayout(row);
  const feet = y + PLAYER_HH * scale;
  return { feet, head: feet - PLAYER_SPRITE_HH * 2 * scale, scale };
}

// The stretch of the line broken out where the runner on `row` goes through: head to feet, padded.
export function wallGap(row) {
  const { feet, head } = runnerSpan(row);
  return { top: head - WALL_GAP_PAD_TOP, bottom: feet + WALL_GAP_PAD_BOTTOM };
}

// Jagged stubs at both ends of the gap on `row`: triangles (flat lists [x0, y0, x1, y1, x2, y2], x relative to
// the line's left edge, y screen). Per end: teeth across the line's width hanging into the gap, plus splinters
// bent sideways off the line near the break. Deterministic, so a restart breaks the same way.
export function gapStubs(row) {
  const { top, bottom } = wallGap(row);
  const W = WALL_LINE_WIDTH;
  const stubs = [];
  for (const [end, dir, seed] of [[top, 1, 9100], [bottom, -1, 9200]]) {
    for (let k = 0; k < 3; k++) {
      const s = seed + k * 3.7;
      const x0 = (W * k) / 3;
      const x1 = (W * (k + 1)) / 3;
      stubs.push([x0, end, x1, end, between(s + 0.1, x0, x1), end + dir * between(s + 0.2, 3, 12)]);
    }
    for (let k = 0; k < 2; k++) {
      const s = seed + 50 + k * 4.3;
      const side = k === 0 ? -1 : 1;
      const edge = side < 0 ? 0 : W;
      const y = end - dir * between(s + 0.1, 1, 12);
      const len = between(s + 0.2, 5, 10);
      stubs.push([edge, y, edge, y + dir * len, edge + side * between(s + 0.3, 2, 6), y + dir * len * between(s + 0.4, 0.6, 1.3)]);
    }
  }
  return stubs;
}

// Deterministic shard `i` of the burst through the gap on `row` (its size and colour depend on `i` only). x is
// relative to the line's left edge (world frame: the line scrolls with the road), y is screen y. It lands on
// floorY, a scatter around the runner's feet line, and lies there as rubble.
export function debrisPiece(i, row) {
  const { feet, head, scale } = runnerSpan(row);
  const s = 7100 + i * 7.31;
  const y0 = between(s + 0.1, head + 10, feet - 6);
  const big = rand(s + 0.2) < 0.3;
  return {
    x0: WALL_LINE_WIDTH + between(s + 0.3, -4, 18),
    y0,
    vx: between(s + 0.4, WALL_DEBRIS_SPEED_MIN, WALL_DEBRIS_SPEED_MAX),
    vy: -between(s + 0.5, WALL_DEBRIS_LIFT_MIN, WALL_DEBRIS_LIFT_MAX),
    spin: between(s + 0.6, -WALL_DEBRIS_SPIN, WALL_DEBRIS_SPIN),
    w: big ? between(s + 0.7, 12, 20) : between(s + 0.7, 5, 11),
    h: big ? between(s + 0.8, 4, 7) : between(s + 0.8, 2, 4),
    color: WALL_DEBRIS_COLORS[Math.floor(rand(s + 0.9) * WALL_DEBRIS_COLORS.length)],
    floorY: Math.max(y0 + 2, feet + between(s + 1.1, -14, 12) * scale),
  };
}

export const debrisPieces = row => Array.from({ length: WALL_DEBRIS_COUNT }, (_, i) => debrisPiece(i, row));

// A shard `tMs` after the impact: ballistic (gravity, exponential horizontal drag, spin) until it lands on
// floorY, then still (in the line's frame, i.e. on the road); fades over the last WALL_DEBRIS_FADE_MS of
// WALL_DEBRIS_LIFE_MS. Returns { x, y, angle, alpha }, or null outside its life.
export function debrisState(p, tMs) {
  if (tMs < 0 || tMs >= WALL_DEBRIS_LIFE_MS) return null;
  const g = WALL_DEBRIS_GRAVITY;
  const landS = (-p.vy + Math.sqrt(p.vy * p.vy + 2 * g * (p.floorY - p.y0))) / g;
  const t = Math.min(tMs / 1000, landS);
  const k = WALL_DEBRIS_DRAG;
  return {
    x: p.x0 + (p.vx * (1 - Math.exp(-k * t))) / k,
    y: t >= landS ? p.floorY : Math.min(p.floorY, p.y0 + p.vy * t + (g * t * t) / 2),
    angle: p.spin * t,
    alpha: Math.min(1, (WALL_DEBRIS_LIFE_MS - tMs) / WALL_DEBRIS_FADE_MS),
  };
}

// Deterministic dust puff `i` billowing out of the gap on `row` (x relative to the line, like debris).
export function dustPuff(i, row) {
  const { feet, head, scale } = runnerSpan(row);
  const s = 8300 + i * 5.17;
  return {
    x0: WALL_LINE_WIDTH / 2 + between(s + 0.1, -20, 30),
    y0: between(s + 0.2, head + (feet - head) * 0.35, feet - 4),
    vx: between(s + 0.3, 60, 260),
    rise: between(s + 0.4, 10, 40),
    scale0: between(s + 0.5, 0.5, 0.9) * scale,
    scale1: between(s + 0.6, 1.8, 2.8) * scale,
    delay: between(s + 0.7, 0, DUST_MAX_DELAY_MS),
  };
}

export const dustPuffs = row => Array.from({ length: WALL_DUST_COUNT }, (_, i) => dustPuff(i, row));

// A puff `tMs` after the impact: drifts forward (decelerating), rises a little and swells (ease-out),
// alpha snaps up then fades to 0 at WALL_DUST_LIFE_MS. Returns { x, y, scale, alpha }, or null outside its life.
export function dustState(p, tMs) {
  const t = tMs - p.delay;
  if (t < 0 || t >= WALL_DUST_LIFE_MS) return null;
  const u = t / WALL_DUST_LIFE_MS;
  const ease = 1 - (1 - u) * (1 - u);
  const fadeIn = Math.min(1, u / 0.12);
  return {
    x: p.x0 + (p.vx * (1 - Math.exp(-3 * (t / 1000)))) / 3,
    y: p.y0 - p.rise * ease,
    scale: p.scale0 + (p.scale1 - p.scale0) * ease,
    alpha: WALL_DUST_ALPHA * fadeIn * (1 - u) ** 1.5,
  };
}

// Impact crack lines radiating from the line at the runner's chest height (mid head..feet): WALL_CRACK_COUNT
// polylines of WALL_CRACK_SEGMENTS wandering segments, fanning up/down (+-80 deg about the vertical, alternating
// sides of the horizontal), strokes alternating near-white / near-black. Returns [{ color, pts: [x0, y0, x1, y1, ...] }],
// x relative to the line's left edge, y screen. Deterministic.
export function crackLines(row) {
  const { head, feet } = runnerSpan(row);
  const cy = (head + feet) / 2;
  return Array.from({ length: WALL_CRACK_COUNT }, (_, i) => {
    let a = Math.PI / 2 + between(6100 + i * 3.1, -1.4, 1.4) + (i % 2 ? Math.PI : 0);
    let x = WALL_LINE_WIDTH / 2;
    let y = cy;
    const pts = [x, y];
    for (let s = 0; s < WALL_CRACK_SEGMENTS; s++) {
      a += between(6100 + i * 3.1 + (s + 1) * 0.37, -0.5, 0.5);
      x += Math.cos(a) * WALL_CRACK_SEGMENT_PX;
      y += Math.sin(a) * WALL_CRACK_SEGMENT_PX;
      pts.push(x, y);
    }
    return { color: i % 2 ? WALL_LINE_COLOR : WALL_CRACK_LIGHT_COLOR, pts };
  });
}

// Cracks' opacity `tMs` after the impact: full, then linear fade over the last WALL_CRACK_FADE_MS; 0 outside [0, WALL_CRACK_MS).
export function crackAlpha(tMs) {
  if (tMs < 0 || tMs >= WALL_CRACK_MS) return 0;
  return Math.min(1, (WALL_CRACK_MS - tMs) / WALL_CRACK_FADE_MS);
}
