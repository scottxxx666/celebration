import {
  PULSE_GLOW_STRENGTH,
  PULSE_GROUPS,
  PULSE_LIFT_STRENGTH,
  PULSE_LIFT_DECAY_BEATS,
} from './config/gameConfig.js';

// Quadratic ease-out: 1 at since = 0, 0 at since >= decay (both in the same unit); 0 when decay <= 0.
export function pulseDecay(since, decay) {
  if (!(decay > 0) || since < 0 || since >= decay) return 0;
  const x = 1 - since / decay;
  return x * x;
}

// 0..1 level of one glow group at `beatTimeMs` (conductor.beatTimeMs: song time from game beat 0, may
// be negative). The beat grid is cut into slots of 1/divisions beat; the group fires on slots where
// slot mod every === offset (floor/mod, so negative times follow the same alternation).
export function groupPulse(beatTimeMs, beatMs, { divisions, every, offset, decay }) {
  const pos = (beatTimeMs * divisions) / beatMs;
  const slot = Math.floor(pos);
  const slotsSince = ((((slot - offset) % every) + every) % every) + (pos - slot);
  return pulseDecay(slotsSince, decay);
}

// All three layers at once: { lift, groups: { [name]: alpha } }. A layer with strength 0 is all 0.
// `opts` overrides the config (tests).
export function beatPulse(beatTimeMs, beatMs, opts = {}) {
  const {
    glowStrength = PULSE_GLOW_STRENGTH,
    groups = PULSE_GROUPS,
    liftStrength = PULSE_LIFT_STRENGTH,
    liftDecayBeats = PULSE_LIFT_DECAY_BEATS,
  } = opts;
  const out = { lift: 0, groups: {} };
  if (liftStrength > 0) {
    const beatPhase = ((((beatTimeMs % beatMs) + beatMs) % beatMs)) / beatMs;
    out.lift = liftStrength * pulseDecay(beatPhase, liftDecayBeats);
  }
  for (const g of groups) out.groups[g.name] = glowStrength > 0 ? glowStrength * groupPulse(beatTimeMs, beatMs, g) : 0;
  return out;
}
