import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

// Top-down light beams shown only during disco sections (src/config/sections.js).
// Purely decorative — sits above the background/beat overlay (−10/−5) and below shadows.
// Each beam is a triangle cone: apex at the top edge (y=0) widening to a base where the
// light lands on the road — a random spot per beat, not pinned to the bottom edge, so pools
// scatter across (and sometimes past) the field. Geometry/colour teleport on every beat.
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
    this.wasActive = false;
  }

  update(songMs, beatCrossed, beatIndex, active) {
    this.beams.forEach(beam => beam.setVisible(active));
    this.pools.forEach(pool => pool.setVisible(active));
    if (!active) {
      this.wasActive = false;
      return;
    }
    // Jump on each beat, plus one immediate jump when disco first turns on so beams
    // don't linger at stale positions until the next beat.
    if (beatCrossed || !this.wasActive) this.jump();
    this.wasActive = true;
  }

  jump() {
    this.beams.forEach((beam, i) => {
      const apexX = -BASE_X_MARGIN + Math.random() * (GAME_WIDTH + 2 * BASE_X_MARGIN);
      const baseCenter = apexX + (Math.random() * 2 - 1) * BEAM_SLANT_MAX;
      const baseY = BASE_Y_MIN + Math.random() * (BASE_Y_MAX - BASE_Y_MIN);
      const hue = Math.random();
      const color = Phaser.Display.Color.HSVToRGB(hue, 1, 1);
      beam.setTo(
        apexX, 0,
        baseCenter - BEAM_HALF_BASE, baseY,
        baseCenter + BEAM_HALF_BASE, baseY
      );
      beam.setFillStyle(color.color);
      // Light pool sits where the beam lands, sharing its hue
      const pool = this.pools[i];
      pool.setPosition(baseCenter, baseY);
      pool.setFillStyle(color.color);
    });
  }

  destroy() {
    this.beams.forEach(beam => beam.destroy());
    this.pools.forEach(pool => pool.destroy());
  }
}
