import {
  GAME_WIDTH, ENEMY_CRUISE_SPEED, SCENERY_PARALLAX,
  BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH,
  BIKE_ARM_SPREAD_DEG, BIKE_ARM_HIT_UPPER_DEG, BIKE_ARM_HIT_FORE_DEG,
  BIKE_ARM_HIT_MS, BIKE_ARM_HOLD_MS, BIKE_ARM_RELAX,
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

// Lean of the arm "hit" at msSinceBeat into beat `beatIndex`, in -1..1 (+1 = fully toward screen-right).
// Even beats hit toward screen-right, odd toward screen-left. The lean snaps from where the previous beat ended
// (-BIKE_ARM_RELAX of this side) to the full hit within BIKE_ARM_HIT_MS (ease-out), holds for
// BIKE_ARM_HOLD_MS, then relaxes to BIKE_ARM_RELAX of the hit by the next beat, so it is continuous
// across beats except for the intended snap.
export function armLean(beatIndex, msSinceBeat, beatMs) {
  const dir = Math.abs(beatIndex % 2) === 0 ? 1 : -1;
  const t = Math.min(Math.max(msSinceBeat, 0), beatMs);
  const hit = 1 - Math.pow(1 - Math.min(t / BIKE_ARM_HIT_MS, 1), 3);
  if (t < BIKE_ARM_HIT_MS) return dir * (-BIKE_ARM_RELAX + (1 + BIKE_ARM_RELAX) * hit);
  const relaxMs = Math.max(beatMs - BIKE_ARM_HIT_MS - BIKE_ARM_HOLD_MS, 1);
  const u = Math.min(Math.max((t - BIKE_ARM_HIT_MS - BIKE_ARM_HOLD_MS) / relaxMs, 0), 1);
  return dir * (1 - (1 - BIKE_ARM_RELAX) * u * u * (3 - 2 * u));
}

// One raised arm from the shoulder at the beat-hit pose. `side` is -1 (screen-left arm) or 1 (screen-right arm);
// every rider uses the same beat so the row hits in unison. Angles are from straight up, positive
// toward +x; the forearm whips further than the upper arm along the lean.
export function armPose(shoulder, beatIndex, msSinceBeat, beatMs, side, upperLen, foreLen) {
  const lean = armLean(beatIndex, msSinceBeat, beatMs);
  const upper = side * rad(BIKE_ARM_SPREAD_DEG) * (1 - Math.abs(lean)) * 0.5 + lean * rad(BIKE_ARM_HIT_UPPER_DEG);
  const fore = upper + lean * rad(BIKE_ARM_HIT_FORE_DEG);
  const elbow = { x: shoulder.x + Math.sin(upper) * upperLen, y: shoulder.y - Math.cos(upper) * upperLen };
  return { elbow, hand: { x: elbow.x + Math.sin(fore) * foreLen, y: elbow.y - Math.cos(fore) * foreLen } };
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
