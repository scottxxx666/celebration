import {
  LAMP_FLICKER_SLOTS_PER_BEAT,
  LAMP_FLICKER_BURST_CHANCE,
  LAMP_FLICKER_BURST_ON_CHANCE,
  LAMP_FLICKER_BURST_LEVEL_MIN,
  LAMP_FLICKER_BLIP_CHANCE,
  LAMP_FLICKER_BLIP_LEVEL_MIN,
  LAMP_FLICKER_BLIP_LEVEL_MAX,
} from './config/gameConfig.js';

// Deterministic 0..1 value from two integers (Math.imul mix); `salt` keeps the
// burst, on/off and level rolls of one slot independent of each other.
function hash01(a, b, salt) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Brightness 0..1 of a dying fluorescent tube at song time: mostly dark, with
// occasional bursts of rapid flicker and rare single blips. Stateless and
// constant within a slot, so `?t=` seeks and negative song times just work.
export function lampFlicker(songMs, beatMs) {
  const slotMs = beatMs / LAMP_FLICKER_SLOTS_PER_BEAT;
  const slot = Math.floor(songMs / slotMs);
  const beat = Math.floor(slot / LAMP_FLICKER_SLOTS_PER_BEAT);
  if (hash01(beat, 0, 1) < LAMP_FLICKER_BURST_CHANCE) {
    if (hash01(slot, 0, 2) >= LAMP_FLICKER_BURST_ON_CHANCE) return 0;
    return LAMP_FLICKER_BURST_LEVEL_MIN + (1 - LAMP_FLICKER_BURST_LEVEL_MIN) * hash01(slot, 0, 3);
  }
  if (hash01(slot, 0, 4) >= LAMP_FLICKER_BLIP_CHANCE) return 0;
  return LAMP_FLICKER_BLIP_LEVEL_MIN + (LAMP_FLICKER_BLIP_LEVEL_MAX - LAMP_FLICKER_BLIP_LEVEL_MIN) * hash01(slot, 0, 5);
}

// A tileSprite with tile scale `scale` shows texture pixel u (of copy k, k*texWidth + u)
// at screen x = stripLeft + (k * texWidth + u - tilePositionX) * scale.
export function copyScreenX({ tilePositionX, stripLeft, texWidth, scale, copy }) {
  return stripLeft + (copy * texWidth - tilePositionX) * scale;
}

// Smallest copy index whose lamp (texture pixel `lampX`) sits at or beyond `rightEdge`,
// i.e. just off the right edge, so that copy scrolls in from the right.
export function firstCopyFromRight({ tilePositionX, stripLeft, lampX, texWidth, scale, rightEdge }) {
  return Math.ceil(((rightEdge - stripLeft) / scale + tilePositionX - lampX) / texWidth);
}
