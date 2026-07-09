import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  DISCO_COLORS,
  HAZE_INNER_WIDTH_RATIOS,
  HAZE_INNER_ALPHA,
  HAZE_APEX_GLOW_WIDTH,
  HAZE_APEX_GLOW_HEIGHT,
  HAZE_APEX_GLOW_ALPHA,
} from '../config/gameConfig.js';

// Top-down light beams shown only during disco sections (src/config/sections.js).
// Purely decorative — sits above the background/beat overlay (−10/−5) and below shadows.
// Each beam is a triangle cone: apex at the top edge (y=0) widening to a base where the
// light lands on the road — a random spot per beat, not pinned to the bottom edge, so pools
// scatter across (and sometimes past) the field. Geometry teleports on every beat; colour is
// coordinated instead — each beam/pool/laser takes a DISTINCT DISCO_COLORS entry offset by its
// element index (from a base index passed in by GameScene), so the set spreads across the
// palette and the whole set advances together per bar (DISCO_HUE_BEATS) — never random.
// A third layer — thin concert-style laser beams — draws straight lines from scattered
// random points along the top edge down through the field; origins/angles still snap on
// every beat, with their colours spread across the palette the same way. The beat-flash
// overlay (in GameScene) uses the base hue.
// Fake haze (docs/disco-upgrade.md P4): each beam also carries nested, narrower/brighter
// "inner cone" triangles sharing its apex/axis/base-center (HAZE_INNER_WIDTH_RATIOS), plus a
// soft glow blob pooled at its apex on the top edge — stacked additive to read as a bright
// light source cutting through fog, no shader needed. Both re-jump in lockstep with the
// parent beam and share its colour.
const BEAM_COUNT = 3;
const BEAM_HALF_BASE = 60; // half-width of the light pool where the beam lands
const BEAM_SLANT_MAX = 60; // max horizontal offset of the base center from the apex (± px)
// Landing point range: mostly on the road, but overshoot both edges so some pools fall off
// the top/bottom of the scene, and the horizontal spread can push a pool past the sides.
const BASE_Y_MIN = 0.5 * GAME_HEIGHT;
const BASE_Y_MAX = 1.15 * GAME_HEIGHT;
const BASE_X_MARGIN = 100; // extra horizontal room past the screen edges for the apex
const POOL_WIDTH = BEAM_HALF_BASE * 2; // flattened glow where the beam hits the road
const POOL_HEIGHT = 60; // squashed vertically to read as a top-down hot spot

const LASER_COUNT = 6;
const LASER_CORE_WIDTH = 2;
const LASER_GLOW_WIDTH = 7;
const LASER_LEN = GAME_WIDTH + GAME_HEIGHT; // long enough any beam crosses the field
// Downward-raking fan; angle measured from +x axis, so ~90° points straight down.
const LASER_ANGLE_MIN = Phaser.Math.DegToRad(70);
const LASER_ANGLE_MAX = Phaser.Math.DegToRad(110);

export class DiscoLights {
  constructor(scene) {
    this.beams = Array.from({ length: BEAM_COUNT }, () =>
      scene.add
        // Placeholder geometry; jump() sets real points on the first active frame.
        // Origin 0,0 so triangle points render at their absolute coordinates.
        .triangle(0, 0, 0, 0, 0, GAME_HEIGHT, 0, GAME_HEIGHT, 0xffffff)
        .setOrigin(0, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.3)
        .setDepth(-4)
        .setVisible(false)
    );
    // Per-beam light pool: a flattened ellipse centered on the beam's base center at the
    // bottom edge, so the visible top half reads as the hot spot where light hits the road.
    this.pools = Array.from({ length: BEAM_COUNT }, () =>
      scene.add
        .ellipse(0, 0, POOL_WIDTH, POOL_HEIGHT, 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.4)
        .setDepth(-4)
        .setVisible(false)
    );
    // Single graphics object holding all laser lines; redrawn from scratch each jump.
    this.lasers = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(-4).setVisible(false);
    // Fake haze: per-beam nested brighter cones (narrower triangles, same apex/axis) stacked
    // on top of the parent beam to fake a bright core near the source.
    this.hazeLayers = Array.from({ length: BEAM_COUNT }, () =>
      HAZE_INNER_WIDTH_RATIOS.map(() =>
        scene.add
          .triangle(0, 0, 0, 0, 0, GAME_HEIGHT, 0, GAME_HEIGHT, 0xffffff)
          .setOrigin(0, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(HAZE_INNER_ALPHA)
          .setDepth(-4)
          .setVisible(false)
      )
    );
    // Fake haze: soft glow blob pooled at each beam's apex on the top edge ("fog catching
    // the lamp"), tinted the same colour as the beam it belongs to.
    this.apexGlows = Array.from({ length: BEAM_COUNT }, () =>
      scene.add
        .ellipse(0, 0, HAZE_APEX_GLOW_WIDTH, HAZE_APEX_GLOW_HEIGHT, 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(HAZE_APEX_GLOW_ALPHA)
        .setDepth(-4)
        .setVisible(false)
    );
    this.wasActive = false;
  }

  update(songMs, beatCrossed, beatIndex, active, colorIndex) {
    this.beams.forEach(beam => beam.setVisible(active));
    this.pools.forEach(pool => pool.setVisible(active));
    this.hazeLayers.forEach(layers => layers.forEach(layer => layer.setVisible(active)));
    this.apexGlows.forEach(glow => glow.setVisible(active));
    this.lasers.setVisible(active);
    if (!active) {
      this.wasActive = false;
      return;
    }
    this.colorIndex = colorIndex;
    // Jump on each beat, plus one immediate jump when disco first turns on so beams
    // don't linger at stale positions until the next beat.
    if (beatCrossed || !this.wasActive) {
      this.jump();
      this.jumpLasers();
    }
    this.wasActive = true;
  }

  jump() {
    this.beams.forEach((beam, i) => {
      const apexX = -BASE_X_MARGIN + Math.random() * (GAME_WIDTH + 2 * BASE_X_MARGIN);
      const baseCenter = apexX + (Math.random() * 2 - 1) * BEAM_SLANT_MAX;
      const baseY = BASE_Y_MIN + Math.random() * (BASE_Y_MAX - BASE_Y_MIN);
      // Distinct palette colour per beam, offset from the shared base index
      const color = DISCO_COLORS[(this.colorIndex + i) % DISCO_COLORS.length];
      beam.setTo(
        apexX, 0,
        baseCenter - BEAM_HALF_BASE, baseY,
        baseCenter + BEAM_HALF_BASE, baseY
      );
      beam.setFillStyle(color);
      // Light pool sits where the beam lands, sharing that beam's colour
      const pool = this.pools[i];
      pool.setPosition(baseCenter, baseY);
      pool.setFillStyle(color);
      // Fake haze: inner cones share this beam's exact apex/axis/base-center, just
      // narrower and brighter, so they sweep and retarget together with the parent.
      this.hazeLayers[i].forEach((layer, j) => {
        const halfBase = BEAM_HALF_BASE * HAZE_INNER_WIDTH_RATIOS[j];
        layer.setTo(
          apexX, 0,
          baseCenter - halfBase, baseY,
          baseCenter + halfBase, baseY
        );
        layer.setFillStyle(color);
      });
      // Apex glow pools at the same apex point, sharing the beam's colour
      this.apexGlows[i].setPosition(apexX, 0);
      this.apexGlows[i].setFillStyle(color);
    });
  }

  // Redraws all laser lines from scattered random origins along the top edge, each with
  // a glow pass (wide, faint) and a core pass (thin, bright); colours spread across the
  // palette by laser index, offset from the shared base index (wrapping).
  jumpLasers() {
    this.lasers.clear();
    for (let i = 0; i < LASER_COUNT; i++) {
      const x0 = Math.random() * GAME_WIDTH;
      const y0 = 0;
      const angle = LASER_ANGLE_MIN + Math.random() * (LASER_ANGLE_MAX - LASER_ANGLE_MIN);
      const x1 = x0 + Math.cos(angle) * LASER_LEN;
      const y1 = y0 + Math.sin(angle) * LASER_LEN;
      const color = DISCO_COLORS[(this.colorIndex + i) % DISCO_COLORS.length];
      this.lasers.lineStyle(LASER_GLOW_WIDTH, color, 0.25);
      this.lasers.lineBetween(x0, y0, x1, y1);
      this.lasers.lineStyle(LASER_CORE_WIDTH, color, 0.9);
      this.lasers.lineBetween(x0, y0, x1, y1);
    }
  }

  destroy() {
    this.beams.forEach(beam => beam.destroy());
    this.pools.forEach(pool => pool.destroy());
    this.hazeLayers.forEach(layers => layers.forEach(layer => layer.destroy()));
    this.apexGlows.forEach(glow => glow.destroy());
    this.lasers.destroy();
  }
}
