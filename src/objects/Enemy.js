import { GAME_WIDTH, ENEMY_SPEED, ENEMY_HW, ENEMY_HH, MAX_SPEED } from '../config/gameConfig.js';

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

  update(dt, playerSpeed) {
    this.x += (this.speed - playerSpeed) * dt;
    this.atBoundary = this.x < -ENEMY_HW;
    if (this.atBoundary) {
      this.x = -ENEMY_HW;
      this.speed = MAX_SPEED - 25;
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
