// Theme table — a road+background pair swaps as a set (docs/image-assets.md
// "Road & background"). BootScene reads `road`/`scenery` to preload; this is
// the single source of truth for the file paths, so no string is duplicated.
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
    // the suburb street on a sunny afternoon, both layers procedural (tools/gen-suburb-day-assets.py)
    road: { key: 'road-suburb-day', file: 'assets/bg/road-suburb-day.png' },
    scenery: { key: 'scenery-suburb-day', file: 'assets/bg/scenery-suburb-day.png' },
    sky: 0x7d9fb8,
    ground: 0x928d83,
  },
};
