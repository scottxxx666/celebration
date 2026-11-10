import {
  GAME_WIDTH, ENEMY_CRUISE_SPEED, SCENERY_PARALLAX,
  BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH,
  BIKE_ARM_HIT_UPPER_DEG, BIKE_ARM_FORWARD_DEG, BIKE_ARM_HAND_DEPTH_SCALE,
  BIKE_ARM_HIT_FRAC, BIKE_ARM_HOLD_FRAC, BIKE_ARM_REST_FRAC, BIKE_ARM_RELAX, BIKE_ARM_OVERSHOOT, BIKE_ARM_SETTLE_FRAC, BIKE_DIP_HIT_MS,
  BIKE_NOD_DROP_PX, BIKE_NOD_HAIR_REST, BIKE_NOD_HAIR_FULL, BIKE_NOD_EYES_HIDE, BIKE_NOD_SQUASH,
} from './config/gameConfig.js';

const TAU = Math.PI * 2;
const rad = deg => deg * Math.PI / 180;

// Total width of the rider row, left edge of the first bike to right edge of the last.
export const BIKE_ROW_WIDTH = (BIKE_COUNT - 1) * BIKE_SPACING + BIKE_WIDTH;

// Crank angle (radians, 0..2π) from the time into the pedal cycle; one turn per `periodMs`.
export function crankAngle(phaseMs, periodMs) {
  return (phaseMs / periodMs) * TAU;
}

// Knee point of a two-bone leg from hip to foot, bending toward +x (forward) for bend = 1.
// A target out of reach (too far, or too close) is clamped, so the knee stays `thigh` from the hip.
export function legIK(hip, foot, thigh, shin, bend = 1) {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const dist = Math.hypot(dx, dy);
  const d = Math.min(Math.max(dist, Math.abs(thigh - shin) + 1e-6), thigh + shin - 1e-6);
  const ux = dist > 1e-6 ? dx / dist : 0; // foot on the hip: no direction, assume straight down
  const uy = dist > 1e-6 ? dy / dist : 1;
  const along = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(thigh * thigh - along * along, 0));
  // (uy, -ux) points to +x when the foot is below the hip
  return { x: hip.x + ux * along + uy * h * bend, y: hip.y + uy * along - ux * h * bend };
}

// Front-on leg of a rider facing the camera. The leg is solved in the sagittal plane (legIK: x =
// forward, toward the camera; y = up/down) from the hip to the pedal on the crank circle, then
// projected to the screen: y is kept, x is the hip's x plus a small outward splay (`side` -1 = screen-left
// leg, +1 = right) proportional to how far forward the knee is. `crank` is {x: forward offset from the
// hip, y} of the crank centre; the two legs run half a turn apart (pass `angle` and `angle + Math.PI`).
export function frontLeg(hip, crank, radius, angle, side, thigh, shin, splay) {
  const pedal = { x: crank.x + Math.cos(angle) * radius, y: crank.y + Math.sin(angle) * radius };
  const k = legIK({ x: 0, y: hip.y }, pedal, thigh, shin);
  return {
    knee: { x: hip.x + side * splay * Math.max(k.x, 0), y: k.y },
    foot: { x: hip.x, y: pedal.y },
  };
}

// Lean of the arm "hit" at msSinceHit into hit `hitIndex` (a hit lasts periodMs: a beat or a fraction of one,
// see BIKE_WAVE_HITS_PER_BEAT), in -(1 + BIKE_ARM_OVERSHOOT)..(1 + BIKE_ARM_OVERSHOOT) (+1 = the hit pose toward screen-right). Even hits go toward screen-right,
// odd toward screen-left. The lean snaps from where the previous hit ended (-BIKE_ARM_RELAX of this side) to
// past the full hit (by BIKE_ARM_OVERSHOOT) within BIKE_ARM_HIT_FRAC of the period (ease-out), springs back to the
// hit pose over the first BIKE_ARM_SETTLE_FRAC of the hold, holds for BIKE_ARM_HOLD_FRAC in all, then relaxes
// to BIKE_ARM_RELAX of the hit by the next hit, so it is continuous across hits except for the intended snap.
export function armLean(hitIndex, msSinceHit, periodMs) {
  const dir = Math.abs(hitIndex % 2) === 0 ? 1 : -1;
  const t = Math.min(Math.max(msSinceHit, 0), periodMs);
  const hitMs = BIKE_ARM_HIT_FRAC * periodMs;
  const holdMs = BIKE_ARM_HOLD_FRAC * periodMs;
  const hit = 1 - Math.pow(1 - Math.min(t / hitMs, 1), 3);
  const peak = 1 + BIKE_ARM_OVERSHOOT;
  if (t < hitMs) return dir * (-BIKE_ARM_RELAX + (peak + BIKE_ARM_RELAX) * hit);
  const settleMs = Math.max(BIKE_ARM_SETTLE_FRAC * periodMs, 1e-9);
  const s = Math.min((t - hitMs) / settleMs, 1);
  if (s < 1) return dir * (peak - BIKE_ARM_OVERSHOOT * s * s * (3 - 2 * s));
  const restMs = BIKE_ARM_REST_FRAC * periodMs;
  if (t >= periodMs - restMs) return dir * BIKE_ARM_RELAX;
  const relaxMs = Math.max(periodMs - restMs - hitMs - holdMs, 1);
  const u = Math.min(Math.max((t - hitMs - holdMs) / relaxMs, 0), 1);
  return dir * (1 - (1 - BIKE_ARM_RELAX) * u * u * (3 - 2 * u));
}

// One raised arm from the shoulder at the hit pose. `side` is -1 (screen-left arm) or 1 (screen-right arm);
// every rider uses the same hit so the row waves in unison. The arm is a straight 3D bone tilted by the lean
// from straight up, toward the hit's side and toward the camera (azimuth BIKE_ARM_FORWARD_DEG), then
// projected orthographically like frontLeg: the on-screen arm shortens and the hand drops as it swings
// forward. Both arms share one direction (parallel). `handScale` (>= 1) grows the fist with its depth.
export function armPose(shoulder, hitIndex, msSinceHit, periodMs, side, upperLen, foreLen) {
  const lean = armLean(hitIndex, msSinceHit, periodMs);
  const tilt = Math.abs(lean) * rad(BIKE_ARM_HIT_UPPER_DEG);
  const az = rad(BIKE_ARM_FORWARD_DEG);
  const dx = Math.sign(lean) * Math.sin(tilt) * Math.cos(az);
  const dy = -Math.cos(tilt); // screen y: up is negative
  const dz = Math.sin(tilt) * Math.sin(az); // toward the camera
  const at = len => ({ x: shoulder.x + dx * len, y: shoulder.y + dy * len });
  return { elbow: at(upperLen), hand: at(upperLen + foreLen), handScale: Math.max(1, 1 + BIKE_ARM_HAND_DEPTH_SCALE * dz) };
}

// Head-bang dip in 0..1 (1 = fully down) at msSinceBeat into a beat: fully down on the beat and for
// BIKE_DIP_HIT_MS, then a smoothstep back up that finishes at mid-beat and stays up until the next beat.
export function gripDip(msSinceBeat, beatMs) {
  const t = Math.min(Math.max(msSinceBeat, 0), beatMs);
  const upMs = Math.max(beatMs / 2 - BIKE_DIP_HIT_MS, 1);
  const u = Math.min(Math.max((t - BIKE_DIP_HIT_MS) / upMs, 0), 1);
  return 1 - u * u * (3 - 2 * u);
}

// Head pose for a nod amount `dip` in 0..1 (0 = upright, 1 = fully bowed): dropPx is how far the head
// sinks, hairEdge the fraction of the head's height covered by hair from the top (the crown showing as the
// face tips away), eyesVisible whether the eyes are still uncovered, squash the head's height multiplier.
export function headNod(dip) {
  const d = Math.min(Math.max(dip, 0), 1);
  return {
    dropPx: BIKE_NOD_DROP_PX * d,
    hairEdge: BIKE_NOD_HAIR_REST + (BIKE_NOD_HAIR_FULL - BIKE_NOD_HAIR_REST) * d,
    eyesVisible: d <= BIKE_NOD_EYES_HIDE,
    squash: 1 - (1 - BIKE_NOD_SQUASH) * d,
  };
}

// Arm gripping the handlebar: shoulder to `grip` with the elbow solved by legIK and flaring outward
// (`side` -1 = screen-left arm, 1 = right). An unreachable grip is clamped like legIK, so the hand
// then stops short of it.
export function gripArm(shoulder, grip, side, upperLen, foreLen) {
  const elbow = legIK(shoulder, grip, upperLen, foreLen, side);
  const d = Math.hypot(grip.x - shoulder.x, grip.y - shoulder.y);
  return { elbow, hand: d <= upperLen + foreLen ? { ...grip } : elbow };
}

// The (beatIndex, msSinceBeat) pair `lagMs` earlier than the given one, so secondary motion (hair) can
// replay the beat-driven curves late. Before the lag has elapsed it falls back into the previous beat.
export function laggedBeat(beatIndex, msSinceBeat, beatMs, lagMs) {
  const t = msSinceBeat - lagMs;
  return t >= 0 ? { beatIndex, msSinceBeat: t } : { beatIndex: beatIndex - 1, msSinceBeat: Math.min(Math.max(t + beatMs, 0), beatMs) };
}

// Darken (k < 1) or lighten an 0xRRGGBB colour by scaling each channel.
export function shade(color, k) {
  const ch = shift => Math.min(255, Math.round(((color >> shift) & 255) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Estimated left x of the rider row at songMs, for the first frame it shows (e.g. after a ?t= seek):
// GAME_WIDTH at the section start, then drifting left with the scenery at SCENERY_PARALLAX.
export function bikeRowStartX(section, songMs) {
  const elapsedS = Math.max(songMs - section.startMs, 0) / 1000;
  return GAME_WIDTH - elapsedS * ENEMY_CRUISE_SPEED * section.speedMult * SCENERY_PARALLAX;
}
