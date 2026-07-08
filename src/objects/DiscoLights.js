import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WALK_ZONE_TOP } from '../config/gameConfig.js';

// Sweeping additive spotlights shown only during disco sections (src/config/sections.js).
// Purely decorative — sits above the background/beat overlay (−10/−5) and below shadows.
const LIGHT_COUNT = 3;
const SWEEP_SPEED = [0.4, 0.6, 0.5]; // rad/s-ish, distinct per light so sweeps drift apart
const SWEEP_PHASE = [0, Math.PI * 0.66, Math.PI * 1.33];
const HUE_STEP = 0.09; // hue advance per beat, applied per light so they stay offset

export class DiscoLights {
  constructor(scene) {
    const midY = WALK_ZONE_TOP + (GAME_HEIGHT - WALK_ZONE_TOP) / 2;
    this.lights = Array.from({ length: LIGHT_COUNT }, () =>
      scene.add
        .ellipse(GAME_WIDTH / 2, midY, 240, 150, 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.35)
        .setDepth(-4)
        .setVisible(false)
    );
  }

  update(songMs, beatCrossed, beatIndex, active) {
    this.lights.forEach(light => light.setVisible(active));
    if (!active) return;

    const midY = WALK_ZONE_TOP + (GAME_HEIGHT - WALK_ZONE_TOP) / 2;
    this.lights.forEach((light, i) => {
      const x =
        GAME_WIDTH / 2 +
        Math.sin((songMs / 1000) * SWEEP_SPEED[i] + SWEEP_PHASE[i]) * (GAME_WIDTH / 2.4);
      const hue = ((beatIndex * HUE_STEP + i / LIGHT_COUNT) % 1 + 1) % 1;
      const color = Phaser.Display.Color.HSVToRGB(hue, 1, 1);
      light.setPosition(x, midY);
      light.setFillStyle(color.color);
    });
  }

  destroy() {
    this.lights.forEach(light => light.destroy());
  }
}
