import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  MIN_SPEED,
  MAX_SPEED,
  ACCEL_STEP,
  DECEL_PER_SEC,
  VERTICAL_SPEED,
} from '../config/gameConfig.js';

const HALF_W = 20;
const HALF_H = 20;

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.speed = MIN_SPEED; // world scroll speed (px/s)

    // Alternating-tap state
    this.lastKey = null; // 'left' | 'right'
    this._prevLeft = false;
    this._prevRight = false;

    this.rect = scene.add.rectangle(x, y, HALF_W * 2, HALF_H * 2, 0x00ff88);
  }

  update(cursors, leftKey, rightKey, delta) {
    const dt = delta / 1000;

    const currLeft = leftKey.isDown;
    const currRight = rightKey.isDown;

    // Fresh press that alternates from lastKey → accelerate
    if (currLeft && !this._prevLeft && this.lastKey !== 'left') {
      this.speed = Math.min(this.speed + ACCEL_STEP, MAX_SPEED);
      this.lastKey = 'left';
    }
    if (currRight && !this._prevRight && this.lastKey !== 'right') {
      this.speed = Math.min(this.speed + ACCEL_STEP, MAX_SPEED);
      this.lastKey = 'right';
    }

    this._prevLeft = currLeft;
    this._prevRight = currRight;

    // Natural deceleration toward MIN_SPEED
    this.speed = Math.max(MIN_SPEED, this.speed - DECEL_PER_SEC * dt);

    // Vertical movement
    if (cursors.up.isDown) {
      this.y -= VERTICAL_SPEED * dt;
    } else if (cursors.down.isDown) {
      this.y += VERTICAL_SPEED * dt;
    }

    this.y = Phaser.Math.Clamp(this.y, HALF_H, GAME_HEIGHT - HALF_H);
    this.rect.setPosition(this.x, this.y);
  }

  // AABB overlap check against an obstacle { x, y, hw, hh }
  overlaps(obs) {
    return (
      Math.abs(this.x - obs.x) < HALF_W + obs.hw &&
      Math.abs(this.y - obs.y) < HALF_H + obs.hh
    );
  }
}
