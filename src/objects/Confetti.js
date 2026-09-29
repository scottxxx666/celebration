import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  CONFETTI_COUNT,
  CONFETTI_COLORS,
  CONFETTI_LIFESPAN_MS,
  CONFETTI_FADE_MS,
  CONFETTI_GRAVITY,
  CONFETTI_SPEED_MIN,
  CONFETTI_SPEED_MAX,
  CONFETTI_SPREAD_DEG,
  CONFETTI_DRAG,
  CONFETTI_SPIN_MAX,
  CONFETTI_FLUTTER_AMP,
  CONFETTI_FLUTTER_FREQ,
  CONFETTI_SIZE_MIN,
  CONFETTI_SIZE_MAX,
} from '../config/gameConfig.js';

const { FloatBetween } = Phaser.Math;

// One-shot concert confetti-cannon pop, fired on a clear/win to celebrate
// success (see GameOverScene). Two cannons at the bottom corners fire a dense fan of
// strips up-and-inward; pieces fall under gravity with horizontal air drag,
// tumble (spin + scaleX flip to fake edge-on paper), and flutter (sinusoidal
// sway), fading out near end of life. Purely visual — pooled add.rectangle
// pieces, no particle emitter, no runtime textures.
const LEFT_CANNON = { x: 0, y: GAME_HEIGHT };
const RIGHT_CANNON = { x: GAME_WIDTH, y: GAME_HEIGHT };
// Base aim: up-and-inward, ~65° above horizontal toward the field center.
const BASE_AIM_DEG = 65;

export class Confetti {
  constructor(scene) {
    // Motion fields are set by burst() before a piece is ever updated
    this.pieces = Array.from({ length: CONFETTI_COUNT }, () => ({
      rect: scene.add.rectangle(0, 0, CONFETTI_SIZE_MIN, CONFETTI_SIZE_MIN, 0xffffff).setDepth(9).setVisible(false),
      alive: false,
    }));
  }

  burst() {
    this.pieces.forEach((piece, i) => {
      const fromLeft = i % 2 === 0;
      const cannon = fromLeft ? LEFT_CANNON : RIGHT_CANNON;
      // Left cannon aims up-right (angle measured CCW from +x, screen y is down so
      // "up" is negative sin); right cannon mirrors it aiming up-left.
      const aimDeg = fromLeft ? -BASE_AIM_DEG : -(180 - BASE_AIM_DEG);
      const angle = Phaser.Math.DegToRad(aimDeg + FloatBetween(-CONFETTI_SPREAD_DEG, CONFETTI_SPREAD_DEG));
      const speed = FloatBetween(CONFETTI_SPEED_MIN, CONFETTI_SPEED_MAX);

      const width = FloatBetween(CONFETTI_SIZE_MIN, CONFETTI_SIZE_MAX);
      const height = width * FloatBetween(0.4, 0.6);
      const color = Phaser.Utils.Array.GetRandom(CONFETTI_COLORS);

      const rect = piece.rect;
      rect.setPosition(cannon.x, cannon.y);
      rect.setSize(width, height);
      rect.setFillStyle(color);
      rect.setAlpha(1);
      rect.setVisible(true);
      rect.rotation = FloatBetween(0, Math.PI * 2);
      rect.scaleX = 1;

      piece.vx = Math.cos(angle) * speed;
      piece.vy = Math.sin(angle) * speed;
      piece.angVel = FloatBetween(-CONFETTI_SPIN_MAX, CONFETTI_SPIN_MAX);
      piece.phase = FloatBetween(0, Math.PI * 2);
      piece.flutterFreq = CONFETTI_FLUTTER_FREQ * FloatBetween(0.75, 1.25);
      piece.life = 0;
      piece.alive = true;
    });
  }

  update(delta) {
    const dt = delta / 1000;
    const drag = Math.pow(CONFETTI_DRAG, dt);
    for (const piece of this.pieces) {
      if (!piece.alive) continue;

      piece.vy += CONFETTI_GRAVITY * dt;
      piece.vx *= drag;

      piece.life += delta;
      const flutter = piece.phase + (piece.life / 1000) * piece.flutterFreq;
      const swayX = Math.sin(flutter) * CONFETTI_FLUTTER_AMP;

      const rect = piece.rect;
      rect.x += (piece.vx + swayX) * dt;
      rect.y += piece.vy * dt;
      rect.rotation += piece.angVel * dt;
      // Fake edge-on paper tumbling — scaleX oscillates through 0 so the strip flips.
      rect.scaleX = Math.cos(flutter);

      rect.alpha = Phaser.Math.Clamp((CONFETTI_LIFESPAN_MS - piece.life) / CONFETTI_FADE_MS, 0, 1);

      if (piece.life >= CONFETTI_LIFESPAN_MS || rect.y > GAME_HEIGHT + 100) {
        piece.alive = false;
        rect.setVisible(false);
      }
    }
  }

  destroy() {
    this.pieces.forEach(piece => piece.rect.destroy());
  }
}
