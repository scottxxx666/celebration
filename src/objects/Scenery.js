import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WALK_ZONE_TOP,
  ROTATE_ZOOM,
  SCENERY_THEME,
  DIM_ROW_LINE_ALPHA,
  DIM_ROW_LINE_PULSE_ALPHA,
  DIM_ROW_LINE_THICKNESS,
  DIM_ROW_LINE_DASH,
  DIM_ROW_LINE_GAP,
} from '../config/gameConfig.js';
import { rowBoundaryYs } from '../rowLayout.js';

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

// One dash + gap, tiled along each row line; generated rather than loaded
const ROW_LINE_KEY = 'dim-row-line';

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

    // Dashed lane-line row dividers for dim sections — over the road art's own lines,
    // above the disco dim (-6) so they stay readable, below the beat flash (-5)
    // and lights (-4). Hidden until setRowLines(); same x widening as the road.
    // The texture outlives the scene (restart), so it is only generated once.
    if (!scene.textures.exists(ROW_LINE_KEY)) {
      scene.make
        .graphics({ add: false })
        .fillStyle(0xffffff)
        .fillRect(0, 0, DIM_ROW_LINE_DASH, DIM_ROW_LINE_THICKNESS)
        .generateTexture(ROW_LINE_KEY, DIM_ROW_LINE_DASH + DIM_ROW_LINE_GAP, DIM_ROW_LINE_THICKNESS)
        .destroy();
    }
    this.rowLines = rowBoundaryYs().map(y =>
      scene.add
        .tileSprite(left, y, width, DIM_ROW_LINE_THICKNESS, ROW_LINE_KEY)
        .setOrigin(0, 0.5)
        .setAlpha(0)
        .setDepth(-5.5),
    );

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

  // fade: 0–1 share of the dim currently applied (GameScene's dim ramp), so the
  // lines come and go with the darkness they compensate for. pulse: 0–1 beat-flash
  // level, lifting the lines from their resting alpha to the pulse peak.
  setRowLines(fade, color, pulse) {
    const alpha = fade * (DIM_ROW_LINE_ALPHA + (DIM_ROW_LINE_PULSE_ALPHA - DIM_ROW_LINE_ALPHA) * pulse);
    for (const line of this.rowLines) line.setTint(color).setAlpha(alpha);
  }

  // dxWorldPx: world pixels to scroll the road left this frame. tilePositionX is in
  // *texture* pixels, so it must be divided by SOURCE_SCALE to move by logical pixels;
  // Phaser wraps tilePositionX itself, no manual bookkeeping needed.
  scroll(dxWorldPx) {
    this.road.tilePositionX += dxWorldPx / SOURCE_SCALE;
    // Row-line texture is at logical size, so it moves by world pixels directly
    for (const line of this.rowLines) line.tilePositionX += dxWorldPx;
  }
}
