import Phaser from 'phaser';
import {
  MIN_SPEED,
  MAX_SPEED,
  ACCEL_STEP,
  DECEL_PER_SEC,
  NUM_ROWS,
  PLAYER_HW,
  PLAYER_HH,
  PLAYER_SPRITE_HH,
  RUN_FRAME_MS,
} from '../config/gameConfig.js';
import { PLAYER_FRAMES } from '../config/runFrames.js';
import { rowLayout } from '../rowLayout.js';
import { RunCycle } from './RunCycle.js';

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

    this.runCycle = new RunCycle(scene, PLAYER_FRAMES, {
      spriteHh: PLAYER_SPRITE_HH,
      hw: PLAYER_HW,
      hh: PLAYER_HH,
      fallbackColor: 0x00ff88,
      frameMs: RUN_FRAME_MS,
    });
    this._applyLayout(rowLayout(this.row));
  }

  update(cursors, leftKey, rightKey, delta) {
    const dt = delta / 1000;

    const currLeft = leftKey.isDown;
    const currRight = rightKey.isDown;

    // Fresh press that alternates from lastKey → accelerate
    if (currLeft && !this._prevLeft) this.tap('left');
    if (currRight && !this._prevRight) this.tap('right');

    this._prevLeft = currLeft;
    this._prevRight = currRight;

    // Natural deceleration toward MIN_SPEED
    this.speed = Math.max(MIN_SPEED, this.speed - DECEL_PER_SEC * dt);

    // Vertical movement — snap to row on each key press
    if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
      this.moveRow(-1);
    } else if (Phaser.Input.Keyboard.JustDown(cursors.down)) {
      this.moveRow(1);
    }

    this.runCycle.update(delta);
    this._applyLayout(rowLayout(this.row));
  }

  // Alternating tap: a press that differs from the last accelerates; a repeat
  // of the same side does nothing. Shared by keyboard (update()) and touch
  // (GameScene pointerdown) input paths.
  tap(side) {
    if (this.lastKey === side) return;
    this.speed = Math.min(this.speed + ACCEL_STEP, MAX_SPEED);
    this.lastKey = side;
  }

  // Row snap, clamped to the walk zone. dir = -1 (up) or +1 (down).
  moveRow(dir) {
    this.row = Phaser.Math.Clamp(this.row + dir, 0, NUM_ROWS - 1);
  }

  _applyLayout({ y, scale, depth }) {
    this.y = y;
    this.runCycle.layout(this.x, y, scale, depth);
  }

  // Forwarders — GameScene calls these on the player without knowing about
  // the run cycle underneath.
  stepFrame() {
    this.runCycle.stepFrame();
  }

  pulse() {
    this.runCycle.pulse();
  }

  // AABB overlap check against an obstacle { x, y, hw, hh }
  overlaps(obs) {
    return (
      Math.abs(this.x - obs.x) < PLAYER_HW + obs.hw &&
      Math.abs(this.y - obs.y) < PLAYER_HH + obs.hh
    );
  }
}
