// Dev/testing flag: `?debug` (any value, or none) pins the player's speed to
// the chaser's max (ENEMY_CRUISE_SPEED) so a run can be played through without
// tapping. The URL never changes at runtime, so this is computed once and
// cached, same shape as songTime.js.
let cached = null;

export function isDebugMode() {
  if (cached !== null) return cached;
  try {
    cached = new URLSearchParams(window.location.search).has('debug');
  } catch {
    cached = false;
  }
  return cached;
}
