// One keyboard step of the volume slider, clamped to 0-1 and rounded to
// 3 decimals so repeated steps never accumulate float error (0.6 + 0.1 -> 0.7).
export function stepVolume(value, dir, step = 0.1) {
  const next = Math.round((value + dir * step) * 1000) / 1000;
  return Math.min(1, Math.max(0, next));
}
