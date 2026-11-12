import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WALK_ZONE_TOP,
  ROTATE_ZOOM,
  SCENERY_PARALLAX,
  DIM_ROW_LINE_ALPHA,
  DIM_ROW_LINE_THICKNESS,
  DIM_ROW_LINE_DASH,
  DIM_ROW_LINE_GAP,
} from '../config/gameConfig.js';
import { rowBoundaryYs } from '../rowLayout.js';
import { SCENERY_THEMES, multiplyColor } from '../config/sceneryThemes.js';

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
  constructor(scene, themeName) {
    const left = GAME_WIDTH / 2 - HALF_SPAN;
    const width = 2 * HALF_SPAN;

    // Base layers show the `from` theme; the overlay set (hidden until a
    // crossfade) shows the `to` theme at alpha t. Overlay depths stay below
    // SpinBikes (-9.5), the dim (-6) and the row lines (-5.5).
    this.base = this.createLayers(scene, themeName, left, width, -10, -11);
    this.overlay = this.createLayers(scene, themeName, left, width, -9.9, -10.9);
    this.setOverlayVisible(false);

    // Aliases for the base set (the layers scroll() advances)
    this.scenery = this.base.scenery;
    this.road = this.base.road;

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
  }

  // One full layer set for a theme. Strips are only widened in x (rotate can
  // swing far-off-screen x into view at those bands) — logical heights unchanged.
  createLayers(scene, themeName, left, width, stripDepth, fillDepth) {
    const theme = SCENERY_THEMES[themeName];
    const strip = (y, height, key) =>
      scene.add
        .tileSprite(left, y, width, height, key)
        .setOrigin(0, 0)
        .setTileScale(SOURCE_SCALE, SOURCE_SCALE)
        .setDepth(stripDepth);

    // Sky fill — above the scenery strip, out to the swept circle
    const skyTop = GAME_HEIGHT / 2 - HALF_SPAN;
    // Ground fill — below the road, out to the swept circle
    const groundBottom = GAME_HEIGHT / 2 + HALF_SPAN;
    const layers = {
      themeName: null,
      scenery: strip(0, WALK_ZONE_TOP, theme.scenery.key),
      road: strip(WALK_ZONE_TOP, GAME_HEIGHT - WALK_ZONE_TOP, theme.road.key),
      sky: scene.add
        .rectangle(left, skyTop, width, 0 - skyTop, theme.sky)
        .setOrigin(0, 0)
        .setDepth(fillDepth),
      ground: scene.add
        .rectangle(left, GAME_HEIGHT, width, groundBottom - GAME_HEIGHT, theme.ground)
        .setOrigin(0, 0)
        .setDepth(fillDepth),
    };
    this.applyTheme(layers, themeName);
    return layers;
  }

  // Only touches the layers when the theme actually changed, so it is cheap to
  // call every frame. tilePositionX and tileScale survive setTexture.
  applyTheme(layers, themeName) {
    if (layers.themeName === themeName) return;
    const theme = SCENERY_THEMES[themeName];
    layers.themeName = themeName;
    const tint = theme.tint ?? 0xffffff;
    for (const [layer, art] of [[layers.scenery, theme.scenery], [layers.road, theme.road]]) {
      layer.setTexture(art.key);
      if (tint === 0xffffff) layer.clearTint();
      else layer.setTint(tint);
    }
    layers.sky.setFillStyle(multiplyColor(theme.sky, tint));
    layers.ground.setFillStyle(multiplyColor(theme.ground, tint));
  }

  setOverlayVisible(visible) {
    const { scenery, road, sky, ground } = this.overlay;
    for (const layer of [scenery, road, sky, ground]) layer.setVisible(visible);
  }

  // Crossfade state from stageBlend: base shows `from`, overlay fades `to` in at
  // alpha t. Settled (t >= 1 or from === to): base shows `to`, overlay hidden.
  setBlend(from, to, t) {
    if (t >= 1 || from === to) {
      this.applyTheme(this.base, to);
      this.setOverlayVisible(false);
      return;
    }
    this.applyTheme(this.base, from);
    this.applyTheme(this.overlay, to);
    const { scenery, road, sky, ground } = this.overlay;
    for (const layer of [scenery, road, sky, ground]) layer.setAlpha(t);
    this.setOverlayVisible(true);
  }

  // fade: 0–1 share of the dim currently applied (GameScene's dim ramp), so the
  // lines come and go with the darkness they compensate for. shown: the blink's
  // current state (hard cut, no fade).
  setRowLines(fade, color, shown) {
    const alpha = shown ? DIM_ROW_LINE_ALPHA * fade : 0;
    for (const line of this.rowLines) line.setTint(color).setAlpha(alpha);
  }

  // dxWorldPx: world pixels to scroll the road left this frame; the scenery follows
  // at SCENERY_PARALLAX of that, so it reads as further away. tilePositionX is in
  // *texture* pixels, so it must be divided by SOURCE_SCALE to move by logical pixels;
  // Phaser wraps tilePositionX itself, no manual bookkeeping needed.
  scroll(dxWorldPx) {
    for (const { road, scenery } of [this.base, this.overlay]) {
      road.tilePositionX += dxWorldPx / SOURCE_SCALE;
      scenery.tilePositionX += (dxWorldPx * SCENERY_PARALLAX) / SOURCE_SCALE;
    }
    // Row-line texture is at logical size, so it moves by world pixels directly
    for (const line of this.rowLines) line.tilePositionX += dxWorldPx;
  }
}
