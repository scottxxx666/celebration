import Phaser from 'phaser';
import {
  MIN_SPEED,
  MAX_SPEED,
  ACCEL_STEP,
  DECEL_PER_SEC,
  NUM_ROWS,
  ROW_HEIGHT,
} from '../config/gameConfig.js';

const HALF_W = 35;
const HALF_H = 35;

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.row = Math.floor(NUM_ROWS / 2); // start in middle row
    this.y = ROW_HEIGHT * this.row + ROW_HEIGHT / 2;
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

    // Vertical movement — snap to row on each key press
    if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
      this.row = Math.max(0, this.row - 1);
    } else if (Phaser.Input.Keyboard.JustDown(cursors.down)) {
      this.row = Math.min(NUM_ROWS - 1, this.row + 1);
    }

    this.y = ROW_HEIGHT * this.row + ROW_HEIGHT / 2;
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
