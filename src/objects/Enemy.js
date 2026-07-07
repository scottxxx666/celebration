import {
  ENEMY_SPEED,
  ENEMY_HW,
  ENEMY_HH,
  ENEMY_CRUISE_SPEED,
  ENEMY_RAMP_START_MS,
  ENEMY_RAMP_END_MS,
  NUM_ROWS,
} from '../config/gameConfig.js';
import { rowLayout, addShadow } from '../rowLayout.js';

export class Enemy {
  constructor(scene, x) {
    this.hw = ENEMY_HW;
    this.hh = ENEMY_HH;
    this.x = x;
    this.row = Math.floor(NUM_ROWS / 2);
    this.targetRow = this.row;
    this.atBoundary = false;
    this.speed = ENEMY_SPEED;
    this.shadow = addShadow(scene, ENEMY_HW);
    this.rect = scene.add.rectangle(x, 0, this.hw * 2, this.hh * 2, 0xff3333);
    this._applyRow();
  }

  update(dt, playerSpeed, songMs) {
    const progress = Math.min(
      1,
      Math.max(0, (songMs - ENEMY_RAMP_START_MS) / (ENEMY_RAMP_END_MS - ENEMY_RAMP_START_MS))
    );
    this.speed = ENEMY_SPEED + (ENEMY_CRUISE_SPEED - ENEMY_SPEED) * progress;
    this.x += (this.speed - playerSpeed) * dt;
    this.atBoundary = this.x < -ENEMY_HW;
    if (this.atBoundary) {
      this.x = -ENEMY_HW;
    }
    this.rect.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x, this.y + ENEMY_HH * this.scale);
  }

  // Tracks the player's row instantly while beat sync is off (intro); once it's
  // on, steps onto the row only on a beat crossing — row-dodging then buys the
  // player up to one beat of separation
  trackRow(playerRow, beatCrossed, beatSyncOn) {
    this.targetRow = playerRow;
    if ((beatCrossed || !beatSyncOn) && this.row !== this.targetRow) {
      this.row = this.targetRow;
      this._applyRow();
    }
  }

  _applyRow() {
    const { y, scale, depth } = rowLayout(this.row);
    this.y = y;
    this.scale = scale;
    this.rect.setPosition(this.x, y).setScale(scale).setDepth(depth);
    this.shadow.setPosition(this.x, y + ENEMY_HH * scale).setScale(scale).setDepth(depth - 0.5);
  }

  destroy() {
    this.rect.destroy();
    this.shadow.destroy();
  }
}
