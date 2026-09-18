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
  PLAYER_FRAME_MS,
} from '../config/gameConfig.js';
import { PLAYER_FRAMES } from '../config/playerSprites.js';
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
    this._frame = 0; // current run-cycle frame index (only used when PLAYER_FRAMES is non-empty)
    this._frameTimer = 0; // ms since the last frame step (free-running fallback)
    this.shadow = addShadow(scene, PLAYER_HW);

    // Sprite mode (run-cycle frames) when configured; otherwise fall back to
    // the original placeholder rectangle. `this.sprite` holds whichever
    // visual object is in play (kept as one field — nothing outside Player
    // referenced the old `this.rect`).
    if (PLAYER_FRAMES.length > 0) {
      this.sprite = scene.add.image(x, y, PLAYER_FRAMES[0].key).setOrigin(0.5, 1);
    } else {
      this.sprite = scene.add.rectangle(x, y, PLAYER_HW * 2, PLAYER_HH * 2, 0x00ff88);
    }
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

    // Free-running walk cycle: steps on its own before the first beat fires
    // (and if beats ever stop); half-beat crossings reset the timer via
    // stepFrame(), keeping the cycle phase-locked once the song is going
    this._frameTimer += delta;
    if (this._frameTimer >= PLAYER_FRAME_MS) this.stepFrame();

    // Recover from the beat squash
    this._squash = Math.min(1, this._squash + 1.2 * dt);
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
    if (PLAYER_FRAMES.length > 0) {
      // Origin (0.5, 1): feet sit on the row's feet line — same point the
      // shadow is anchored at — so the beat squash shrinks toward the feet
      // for free.
      const feetY = y + PLAYER_HH * scale;
      const spriteScale = (PLAYER_SPRITE_HH * 2 / this.sprite.height) * scale;
      this.sprite
        .setPosition(this.x, feetY)
        .setScale(spriteScale, spriteScale * this._squash)
        .setDepth(depth);
    } else {
      this.sprite
        .setPosition(this.x, y)
        .setScale(scale, scale * this._squash)
        .setDepth(depth);
    }
    this.shadow
      .setPosition(this.x, y + PLAYER_HH * scale)
      .setScale(scale)
      .setDepth(depth - 0.5);
  }

  // Advance the run cycle one frame (wrapping) and restart the free-running
  // timer. Called on 8th-note crossings and by the timer fallback in update();
  // a no-op when PLAYER_FRAMES is empty.
  stepFrame() {
    this._frameTimer = 0;
    if (PLAYER_FRAMES.length === 0) return;
    this._frame = (this._frame + 1) % PLAYER_FRAMES.length;
    this.sprite.setTexture(PLAYER_FRAMES[this._frame].key);
  }

  // Squash on 8th notes — beat bounce synced to the music, only once the
  // beat-sync layer is on
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
