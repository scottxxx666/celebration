import {
  ENEMY_SPEED,
  ENEMY_HW,
  ENEMY_HH,
  ENEMY_CRUISE_SPEED,
  ENEMY_RAMP_START_MS,
  ENEMY_RAMP_END_MS,
} from '../config/gameConfig.js';

export class Enemy {
  constructor(scene, x, y) {
    this.hw = ENEMY_HW;
    this.hh = ENEMY_HH;
    this.x = x;
    this.y = y;
    this.atBoundary = false;
    this.speed = ENEMY_SPEED;
    this.rect = scene.add.rectangle(x, y, this.hw * 2, this.hh * 2, 0xff3333);
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

  trackY(playerY) {
    this.y = playerY;
  }

  destroy() {
    this.rect.destroy();
  }
}
