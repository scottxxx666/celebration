import { GAME_WIDTH, GAME_HEIGHT, WALK_ZONE_TOP, ROTATE_ZOOM, SCENERY_THEME } from '../config/gameConfig.js';

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
};

// Both PNGs are authored at 2× logical size (docs/image-assets.md), so a
// tileSprite must be drawn at half scale to land back at logical pixels —
// otherwise it shows only the far half of the texture and repeats vertically.
const SOURCE_SCALE = 0.5;

// Visible box at ROTATE_ZOOM is GAME_WIDTH/ROTATE_ZOOM × GAME_HEIGHT/ROTATE_ZOOM;
// spinning it about the world centre sweeps a circle of that box's diagonal.
// Oversize the scenery layers to that radius so rotate's zoom-out/spin never
// reveals black outside the art (docs/image-assets.md "Handling the rotate section").
const HALF_SPAN = Math.hypot(GAME_WIDTH / ROTATE_ZOOM, GAME_HEIGHT / ROTATE_ZOOM) / 2;

export class Scenery {
  constructor(scene) {
    const theme = SCENERY_THEMES[SCENERY_THEME];

    const left = GAME_WIDTH / 2 - HALF_SPAN;
    const width = 2 * HALF_SPAN;

    // Scenery strip (static, no parallax — matches today's behaviour). Only
    // widened in x (rotate can swing far-off-screen x into view at this y
    // band) — its logical height (WALK_ZONE_TOP) is unchanged.
    this.scenery = scene.add
      .tileSprite(left, 0, width, WALK_ZONE_TOP, theme.scenery.key)
      .setOrigin(0, 0)
      .setTileScale(SOURCE_SCALE, SOURCE_SCALE)
      .setDepth(-10);

    // Road — scrolled by scroll() below. Same x-only widening as scenery.
    this.road = scene.add
      .tileSprite(left, WALK_ZONE_TOP, width, GAME_HEIGHT - WALK_ZONE_TOP, theme.road.key)
      .setOrigin(0, 0)
      .setTileScale(SOURCE_SCALE, SOURCE_SCALE)
      .setDepth(-10);

    // Sky fill — above the scenery strip, out to the swept circle
    const skyTop = GAME_HEIGHT / 2 - HALF_SPAN;
    scene.add
      .rectangle(left, skyTop, width, 0 - skyTop, theme.sky)
      .setOrigin(0, 0)
      .setDepth(-11);

    // Ground fill — below the road, out to the swept circle
    const groundBottom = GAME_HEIGHT / 2 + HALF_SPAN;
    scene.add
      .rectangle(left, GAME_HEIGHT, width, groundBottom - GAME_HEIGHT, theme.ground)
      .setOrigin(0, 0)
      .setDepth(-11);
  }

  // dxWorldPx: world pixels to scroll the road left this frame. tilePositionX is in
  // *texture* pixels, so it must be divided by SOURCE_SCALE to move by logical pixels;
  // Phaser wraps tilePositionX itself, no manual bookkeeping needed.
  scroll(dxWorldPx) {
    this.road.tilePositionX += dxWorldPx / SOURCE_SCALE;
  }
}
