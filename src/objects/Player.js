import Phaser from 'phaser';
import {
  MIN_SPEED,
  MAX_SPEED,
  ACCEL_STEP,
  DECEL_PER_SEC,
  NUM_ROWS,
  PLAYER_HW,
  PLAYER_HH,
} from '../config/gameConfig.js';
import { rowLayout, addShadow } from '../rowLayout.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.row = Math.floor(NUM_ROWS / 2); // start in middle row
    this.speed = MIN_SPEED; // world scroll speed (px/s)

    // Alternating-tap state
    this.lastKey = null; // 'left' | 'right'
    this._prevLeft = false;
    this._prevRight = false;

    this._squash = 1; // beat-pulse squash factor on top of the row scale
    this.shadow = addShadow(scene, PLAYER_HW);
    this.rect = scene.add.rectangle(x, y, PLAYER_HW * 2, PLAYER_HH * 2, 0x00ff88);
    this._applyLayout(rowLayout(this.row));
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

    // Recover from the beat squash
    this._squash = Math.min(1, this._squash + 1.2 * dt);
    this._applyLayout(rowLayout(this.row));
  }

  _applyLayout({ y, scale, depth }) {
    this.y = y;
    this.rect
      .setPosition(this.x, y)
      .setScale(scale, scale * this._squash)
      .setDepth(depth);
    this.shadow
      .setPosition(this.x, y + PLAYER_HH * scale)
      .setScale(scale)
      .setDepth(depth - 0.5);
  }

  // Squash on 8th notes — placeholder run-cycle bounce synced to the music
  pulse() {
    this._squash = 0.85;
  }

  // AABB overlap check against an obstacle { x, y, hw, hh }
  overlaps(obs) {
    return (
      Math.abs(this.x - obs.x) < PLAYER_HW + obs.hw &&
      Math.abs(this.y - obs.y) < PLAYER_HH + obs.hh
    );
  }
}
