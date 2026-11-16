// Theme table — a road+background pair swaps as a set (docs/image-assets.md
// "Road & background"). BootScene reads `road`/`scenery` to preload; this is
// the single source of truth for the file paths, so no string is duplicated.
// Optional `tint` (0xRRGGBB) is multiplied onto the whole theme — strips via
// setTint, sky/ground fills via multiplyColor; omitted = 0xffffff = unchanged.
// Optional `dim` (0-1): peak alpha of a black mask Scenery draws over the theme's road, scenery and
// crowd (see themeDim); omitted = 0. Optional `dimColor` (0xRRGGBB, default black) is its colour.
// Optional `flicker` ({ key, file, lampX }, preloaded like the strips): an RGBA glow
// image the size of the scenery texture whose alpha Scenery drives with lampFlicker().
// `lampX` is the lamp's x in texture pixels; only the first copy of the (tiling) strip
// to scroll in from the right is lit, so one lamp flickers rather than every repeat.
export const SCENERY_THEMES = {
  night: {
    road: { key: 'road-night', file: 'assets/bg/road-night.png' },
    scenery: { key: 'scenery-night', file: 'assets/bg/scenery-night.png' },
    sky: 0x271837, // matches the scenery PNG's top row — fill above it
    ground: 0x31374b, // matches the road PNG's bottom row — fill below it
  },
  suburb: {
    // suburb backdrop over its own procedural asphalt road (tools/gen-suburb-road.py)
    road: { key: 'road-suburb', file: 'assets/bg/road-suburb.png' },
    scenery: { key: 'scenery-suburb', file: 'assets/bg/scenery-suburb.png' },
    sky: 0x121316,
    ground: 0x363e42,
  },
  suburbDay: {
    // AI backdrop drawn from the procedural layout (tools/gen-suburb-day-assets.py), procedural road
    road: { key: 'road-suburb-day', file: 'assets/bg/road-suburb-day.png' },
    scenery: { key: 'scenery-suburb-day', file: 'assets/bg/scenery-suburb-day.png' },
    sky: 0xc8d3d4,
    ground: 0x928d83,
    tint: 0xd0d0d0, // darkens the too-light AI day art; tune here
  },
  desert: {
    // AI hazy-dune backdrop drawn from the procedural layout (tools/gen-desert-assets.py), procedural road
    road: { key: 'road-desert', file: 'assets/bg/road-desert.png' },
    scenery: { key: 'scenery-desert', file: 'assets/bg/scenery-desert.png' },
    sky: 0x8f8973,
    ground: 0x7f6d55,
  },
  underground: {
    // dim tiled underpass, procedural road + scenery (tools/gen-underground-assets.py)
    road: { key: 'road-underground', file: 'assets/bg/road-underground.png' },
    scenery: { key: 'scenery-underground', file: 'assets/bg/scenery-underground.png' },
    flicker: { key: 'scenery-underground-flicker', file: 'assets/bg/scenery-underground-flicker.png', lampX: 1000 },
    sky: 0x070c0b,
    ground: 0x262b29,
  },
  concert: {
    // dark concert stage: AI-restyled scenery (layout drawing, road, glow and crowd layers from tools/gen-concert-assets.py)
    road: { key: 'road-concert', file: 'assets/bg/road-concert.png' },
    scenery: { key: 'scenery-concert', file: 'assets/bg/scenery-concert.png' },
    sky: 0x000103,
    ground: 0x242427,
    // two-frame crowd silhouettes (arms down / arms up, neighbours opposite), swapped on the beat by src/crowdSway.js
    crowd: [
      { key: 'scenery-concert-crowd-a', file: 'assets/bg/scenery-concert-crowd-a.png' },
      { key: 'scenery-concert-crowd-b', file: 'assets/bg/scenery-concert-crowd-b.png' },
    ],
    // additive glow strips (lamp halos per colour group + the LED wall), pulsed on the beat by src/beatPulse.js
    pulse: [
      { key: 'scenery-concert-glow-magenta', file: 'assets/bg/scenery-concert-glow-magenta.png', group: 'magenta' },
      { key: 'scenery-concert-glow-cyan', file: 'assets/bg/scenery-concert-glow-cyan.png', group: 'cyan' },
      { key: 'scenery-concert-glow-wall', file: 'assets/bg/scenery-concert-glow-wall.png', group: 'wall' },
    ],
  },
  // crowd silhouettes only: the concert's sky/road/ground and crowd over a fully transparent
  // scenery strip (no stage art, glow or pulse); used for the windows around the concert stage
  crowdOnly: {
    road: { key: 'road-concert', file: 'assets/bg/road-concert.png' },
    scenery: { key: 'scenery-blank', file: 'assets/bg/scenery-blank.png' },
    sky: 0x000103,
    ground: 0x242427,
    dim: 0.4, // grey-green mask over road + scenery + crowd (peak alpha), so the purple road reads as a dark corridor
    dimColor: 0x2c3430,
    get crowd() { return SCENERY_THEMES.concert.crowd; },
  },
};

// Per-channel multiply of two 0xRRGGBB colours (white tint = unchanged).
export function multiplyColor(color, tint) {
  const ch = shift => Math.round((((color >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Mask alpha at a stage blend ({ from, to, t }): each theme's `dim` weighted by its share of the
// crossfade, so the mask fades with the theme rather than popping.
export function themeDim(from, to, t) {
  if (from === to) return SCENERY_THEMES[to].dim ?? 0;
  return (SCENERY_THEMES[from].dim ?? 0) * (1 - t) + (SCENERY_THEMES[to].dim ?? 0) * t;
}

// Mask colour at a stage blend: the incoming theme's `dimColor`, else the outgoing one's, else black.
export function themeDimColor(from, to) {
  return SCENERY_THEMES[to].dimColor ?? SCENERY_THEMES[from].dimColor ?? 0x000000;
}
