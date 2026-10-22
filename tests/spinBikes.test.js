import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crankAngle, legIK, frontLeg, armPose, armLean, gripDip, headNod, gripArm, shade, bikeRowStartX } from '../src/spinBikes.js';
import {
  GAME_WIDTH, ENEMY_CRUISE_SPEED, SCENERY_PARALLAX, BIKE_ARM_HIT_MS, BIKE_ARM_RELAX, BIKE_DIP_HIT_MS, BIKE_GRIP_HUNCH_PX,
  BIKE_NOD_DROP_PX, BIKE_NOD_HAIR_REST, BIKE_NOD_HAIR_FULL, BIKE_NOD_SQUASH,
  BIKE_FLOOR_Y, BIKE_SHOULDER_RISE, BIKE_SHOULDER_HALF, BIKE_HIP_HALF, BIKE_HIP_RISE, BIKE_SPLAY,
  BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN,
  BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH,
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
  const a = armPose(sh, 0, BIKE_ARM_HIT_MS, BEAT, 1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
  const b = armPose(sh, 0, BIKE_ARM_HIT_MS + 80, BEAT, 1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
  near(a.hand.x, b.hand.x);
  assert.ok(a.hand.x > sh.x + 15);
});

test('odd beats mirror even beats', () => {
  for (const t of [0, 30, 100, 200, 300, BEAT]) {
    for (const side of [-1, 1]) {
      const e = armPose(sh, 4, t, BEAT, side, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
      const o = armPose(sh, 5, t, BEAT, -side, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
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
        const p = armPose(sh, beat, t, BEAT, side, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
        assert.ok(Number.isFinite(p.hand.x) && Number.isFinite(p.hand.y));
        near(Math.hypot(p.elbow.x - sh.x, p.elbow.y - sh.y), BIKE_UPPER_ARM_LEN);
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

const R = 6;
const hipL = { x: -BIKE_HIP_HALF, y: -BIKE_HIP_RISE };
const hipR = { x: BIKE_HIP_HALF, y: -BIKE_HIP_RISE };
const crankC = { x: 6, y: -28 };
const legs = a => ({
  l: frontLeg(hipL, crankC, R, a, -1, BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY),
  r: frontLeg(hipR, crankC, R, a + Math.PI, 1, BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY),
});

test('frontLeg: feet differ by the crank diameter at the stroke ends and match at the midpoints', () => {
  near(Math.abs(legs(Math.PI / 2).l.foot.y - legs(Math.PI / 2).r.foot.y), 2 * R);
  near(Math.abs(legs(-Math.PI / 2).l.foot.y - legs(-Math.PI / 2).r.foot.y), 2 * R);
  near(legs(0).l.foot.y, legs(0).r.foot.y);
  near(legs(Math.PI).l.foot.y, legs(Math.PI).r.foot.y);
  assert.equal(legs(0.7).l.foot.x, hipL.x);
  assert.equal(legs(0.7).r.foot.x, hipR.x);
});

test('frontLeg: the knee rises as the foot rises', () => {
  let prev = null;
  for (let a = Math.PI / 2; a <= 1.5 * Math.PI + 1e-9; a += 0.1) { // bottom of the stroke to the top
    const { knee, foot } = frontLeg(hipL, crankC, R, a, -1, BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY);
    if (prev) {
      assert.ok(foot.y <= prev.foot.y + 1e-9);
      assert.ok(knee.y <= prev.knee.y + 0.1, // near full extension the knee barely moves, so allow sub-pixel wobble
         `knee ${knee.y} vs ${prev.knee.y} @${a}`);
    }
    prev = { knee, foot };
  }
  const bottom = frontLeg(hipL, crankC, R, Math.PI / 2, -1, BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY);
  assert.ok(prev.knee.y < bottom.knee.y - 5);
});

test('frontLeg: knees splay outward, bounded by the splay fraction of the thigh', () => {
  for (let a = 0; a < 2 * Math.PI; a += 0.1) {
    const { l, r } = legs(a);
    for (const [k, hip, side] of [[l.knee, hipL, -1], [r.knee, hipR, 1]]) {
      assert.ok(Number.isFinite(k.x) && Number.isFinite(k.y));
      assert.ok(side * (k.x - hip.x) >= 0);
      assert.ok(Math.abs(k.x - hip.x) <= BIKE_SPLAY * BIKE_THIGH_LEN + 1e-9);
    }
  }
});

test('raised hands stay clear of the HUD strip (y >= 50) at every point of the beat', () => {
  const shY = BIKE_FLOOR_Y - BIKE_SHOULDER_RISE;
  let top = Infinity;
  for (let beat = 0; beat < 2; beat++) {
    for (let t = 0; t <= BEAT; t++) {
      for (const [side, x] of [[-1, -BIKE_SHOULDER_HALF], [1, BIKE_SHOULDER_HALF]]) {
        top = Math.min(top, armPose({ x, y: shY }, beat, t, BEAT, side, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN).hand.y);
      }
    }
  }
  assert.ok(top >= 50, `highest hand at y=${top}`);
});

test('the rider row spans roughly 600-700 px', () => {
  const span = (BIKE_COUNT - 1) * BIKE_SPACING + BIKE_WIDTH;
  assert.ok(span >= 600 && span <= 700, `${span}`);
});

test('gripDip is fully down on the beat, back up by mid-beat, bounded and finite', () => {
  near(gripDip(0, BEAT), 1);
  near(gripDip(BIKE_DIP_HIT_MS, BEAT), 1);
  for (let t = Math.ceil(BEAT / 2); t <= BEAT; t++) near(gripDip(t, BEAT), 0);
  let prev = 1;
  for (let t = 0; t <= BEAT; t++) {
    const d = gripDip(t, BEAT);
    assert.ok(Number.isFinite(d) && d >= 0 && d <= 1);
    assert.ok(d <= prev + 1e-9); // never re-descends within a beat
    prev = d;
  }
  assert.ok(Number.isFinite(gripDip(-5, BEAT)) && Number.isFinite(gripDip(BEAT + 50, BEAT)));
  assert.ok(Number.isFinite(gripDip(10, 100))); // beat shorter than the hit window
});

test('gripArm lands the hand on the grip with both bones intact, elbow flared outward, with the shoulders fixed', () => {
  const barY = BIKE_FLOOR_Y - 70 - 3;
  {
    const dip = 0;
    const shY = BIKE_FLOOR_Y - BIKE_SHOULDER_RISE + BIKE_GRIP_HUNCH_PX; // shoulders no longer move with the nod
    for (const side of [-1, 1]) {
      const shoulder = { x: side * BIKE_SHOULDER_HALF, y: shY };
      const grip = { x: side * 15, y: barY };
      const { elbow, hand } = gripArm(shoulder, grip, side, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
      near(hand.x, grip.x); near(hand.y, grip.y);
      near(dist(shoulder, elbow), BIKE_UPPER_ARM_LEN);
      near(dist(elbow, hand), BIKE_FOREARM_LEN);
      assert.ok(side * (elbow.x - shoulder.x) > 0, `elbow flares outward (dip ${dip})`);
    }
  }
});

test('headNod: upright at dip 0, fully bowed at 1, monotonic, bounded and clamped', () => {
  const up = headNod(0);
  assert.deepEqual(up, { dropPx: 0, hairEdge: BIKE_NOD_HAIR_REST, eyesVisible: true, squash: 1 });
  const down = headNod(1);
  near(down.dropPx, BIKE_NOD_DROP_PX);
  near(down.hairEdge, BIKE_NOD_HAIR_FULL);
  assert.ok(down.hairEdge > 0.85 && down.hairEdge < 1);
  assert.equal(down.eyesVisible, false);
  near(down.squash, BIKE_NOD_SQUASH);
  let prev = up;
  for (let d = 0; d <= 1.0001; d += 0.01) {
    const n = headNod(d);
    assert.ok(n.dropPx >= prev.dropPx && n.hairEdge >= prev.hairEdge && n.squash <= prev.squash);
    assert.ok(!n.eyesVisible || prev.eyesVisible); // once hidden, stays hidden
    assert.ok(n.squash > 0 && n.hairEdge <= 1);
    prev = n;
  }
  assert.deepEqual(headNod(-1), up);
  assert.deepEqual(headNod(5), down);
});
