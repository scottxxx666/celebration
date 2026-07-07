import {
  ENEMY_SPEED,
  ENEMY_HW,
  ENEMY_HH,
  ENEMY_CRUISE_SPEED,
  ENEMY_RAMP_START_MS,
  ENEMY_RAMP_END_MS,
  NUM_ROWS,
  ROW_HEIGHT,
  WALK_ZONE_TOP,
} from '../config/gameConfig.js';

export class Enemy {
  constructor(scene, x) {
    this.hw = ENEMY_HW;
    this.hh = ENEMY_HH;
    this.x = x;
    this.row = Math.floor(NUM_ROWS / 2);
    this.y = WALK_ZONE_TOP + ROW_HEIGHT * this.row + ROW_HEIGHT / 2;
    this.targetRow = this.row;
    this.atBoundary = false;
    this.speed = ENEMY_SPEED;
    this.rect = scene.add.rectangle(x, this.y, this.hw * 2, this.hh * 2, 0xff3333);
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
  }

  // Tracks the player's row instantly while beat sync is off (intro); once it's
  // on, steps onto the row only on a beat crossing — row-dodging then buys the
  // player up to one beat of separation
  trackRow(playerRow, beatCrossed, beatSyncOn) {
    this.targetRow = playerRow;
    if ((beatCrossed || !beatSyncOn) && this.row !== this.targetRow) {
      this.row = this.targetRow;
      this.y = WALK_ZONE_TOP + ROW_HEIGHT * this.row + ROW_HEIGHT / 2;
    }
  }

  destroy() {
    this.rect.destroy();
  }
}
