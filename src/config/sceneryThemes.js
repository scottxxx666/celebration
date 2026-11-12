// Theme table — a road+background pair swaps as a set (docs/image-assets.md
// "Road & background"). BootScene reads `road`/`scenery` to preload; this is
// the single source of truth for the file paths, so no string is duplicated.
// Optional `tint` (0xRRGGBB) is multiplied onto the whole theme — strips via
// setTint, sky/ground fills via multiplyColor; omitted = 0xffffff = unchanged.
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
};

// Per-channel multiply of two 0xRRGGBB colours (white tint = unchanged).
export function multiplyColor(color, tint) {
  const ch = shift => Math.round((((color >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
