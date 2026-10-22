import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crankAngle, legIK, armPose, armLean, shade, bikeRowStartX } from '../src/spinBikes.js';
import {
  GAME_WIDTH, ENEMY_CRUISE_SPEED, SCENERY_PARALLAX, BIKE_ARM_HIT_MS, BIKE_ARM_RELAX,
} from '../src/config/gameConfig.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('legIK keeps both segment lengths when the foot is reachable', () => {
  const hip = { x: 0, y: 0 };
  for (const foot of [{ x: 4, y: 34 }, { x: -9, y: 40 }, { x: 10, y: 30 }]) {
    const knee = legIK(hip, foot, 24, 26);
    near(dist(hip, knee), 24);
    near(dist(knee, foot), 26);
  }
});

test('legIK bends the knee forward (+x) for a downward leg', () => {
  assert.ok(legIK({ x: 0, y: 0 }, { x: 0, y: 40 }, 24, 26).x > 0);
  assert.ok(legIK({ x: 0, y: 0 }, { x: 0, y: 40 }, 24, 26, -1).x < 0);
});

test('legIK clamps unreachable targets: thigh length kept, no NaN', () => {
  const hip = { x: 0, y: 0 };
  for (const foot of [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 1, y: 0 }]) {
    const knee = legIK(hip, foot, 24, 26);
    assert.ok(Number.isFinite(knee.x) && Number.isFinite(knee.y));
    near(dist(hip, knee), 24, 1e-3);
  }
  // too far: straight leg along the hip-foot line
  near(legIK(hip, { x: 0, y: 100 }, 24, 26).y, 24, 1e-3);
});

test('crank completes one turn per period and the two pedals are opposite', () => {
  const period = 2 * 400;
  near(crankAngle(0, period), 0);
  near(crankAngle(period / 4, period), Math.PI / 2);
  near(crankAngle(period - 1e-9, period), 2 * Math.PI, 1e-6);
  const a = crankAngle(123, period);
  const p1 = { x: Math.cos(a), y: Math.sin(a) };
  const p2 = { x: Math.cos(a + Math.PI), y: Math.sin(a + Math.PI) };
  near(p1.x + p2.x, 0);
  near(p1.y + p2.y, 0);
});

test('bikeRowStartX is GAME_WIDTH at the section start and decreases with time', () => {
  const section = { startMs: 14000, speedMult: 1 };
  near(bikeRowStartX(section, 14000), GAME_WIDTH);
  near(bikeRowStartX(section, 13000), GAME_WIDTH); // before the start: no overshoot to the right
  near(bikeRowStartX(section, 15000), GAME_WIDTH - ENEMY_CRUISE_SPEED * SCENERY_PARALLAX);
  assert.ok(bikeRowStartX(section, 16000) < bikeRowStartX(section, 15000));
  assert.ok(bikeRowStartX({ ...section, speedMult: 1.5 }, 15000) < bikeRowStartX(section, 15000));
});

const BEAT = 398;
const sh = { x: 100, y: 100 };

test('arms reach the hit pose by BIKE_ARM_HIT_MS and hold it', () => {
  near(armLean(0, BIKE_ARM_HIT_MS, BEAT), 1);
  near(armLean(1, BIKE_ARM_HIT_MS, BEAT), -1);
  near(armLean(0, BIKE_ARM_HIT_MS + 100, BEAT), 1); // still held
  // it snaps: most of the way there within the first third of the hit window
  assert.ok(armLean(0, BIKE_ARM_HIT_MS / 3, BEAT) > 0.5);
  // pose at the hit is the same pose a little later in the hold
  const a = armPose(sh, 0, BIKE_ARM_HIT_MS, BEAT, 1, 19, 18);
  const b = armPose(sh, 0, BIKE_ARM_HIT_MS + 80, BEAT, 1, 19, 18);
  near(a.hand.x, b.hand.x);
  assert.ok(a.hand.x > sh.x + 20);
});

test('odd beats mirror even beats', () => {
  for (const t of [0, 30, 100, 200, 300, BEAT]) {
    for (const side of [-1, 1]) {
      const e = armPose(sh, 4, t, BEAT, side, 19, 18);
      const o = armPose(sh, 5, t, BEAT, -side, 19, 18);
      near(e.hand.x - sh.x, -(o.hand.x - sh.x), 1e-9);
      near(e.hand.y, o.hand.y, 1e-9);
      near(e.elbow.x - sh.x, -(o.elbow.x - sh.x), 1e-9);
    }
  }
  assert.equal(Math.sign(armLean(-3, 200, BEAT)), -1); // negative (pre-first-beat) indices keep alternating
  assert.equal(Math.sign(armLean(-2, 200, BEAT)), 1);
});

test('arms stay raised, lengths hold, and the lean is bounded and continuous', () => {
  for (let beat = -2; beat < 4; beat++) {
    let prev = null;
    for (let t = 0; t <= BEAT; t += 2) {
      const lean = armLean(beat, t, BEAT);
      assert.ok(Number.isFinite(lean) && Math.abs(lean) <= 1 + 1e-9);
      // no jumps except the snap at the very start of the beat
      if (prev !== null && t > BIKE_ARM_HIT_MS) assert.ok(Math.abs(lean - prev) < 0.05, `${beat}@${t}`);
      prev = lean;
      for (const side of [-1, 1]) {
        const p = armPose(sh, beat, t, BEAT, side, 19, 18);
        assert.ok(Number.isFinite(p.hand.x) && Number.isFinite(p.hand.y));
        near(Math.hypot(p.elbow.x - sh.x, p.elbow.y - sh.y), 19);
        assert.ok(p.elbow.y < sh.y && p.hand.y < sh.y);
      }
    }
  }
});

test('lean relaxes to BIKE_ARM_RELAX by the end of the beat and the next beat starts from its opposite', () => {
  near(armLean(0, BEAT, BEAT), BIKE_ARM_RELAX);
  near(armLean(1, 0, BEAT), BIKE_ARM_RELAX); // continuous with the previous beat's end; the snap then goes the other way
  near(armLean(0, BEAT + 500, BEAT), BIKE_ARM_RELAX); // clamped past the beat
  assert.ok(Number.isFinite(armLean(0, 100, 50))); // beat shorter than the hit+hold window
});

test('shade scales channels and clamps', () => {
  assert.equal(shade(0xff8040, 0.5), 0x804020);
  assert.equal(shade(0x808080, 10), 0xffffff);
});
