import { GAME_WIDTH, ENEMY_SPEED, ENEMY_HW, ENEMY_HH } from '../config/gameConfig.js';

export class Enemy {
  constructor(scene, x, y) {
    this.hw = ENEMY_HW;
    this.hh = ENEMY_HH;
    this.x = x;
    this.y = y;
    this.rect = scene.add.rectangle(x, y, this.hw * 2, this.hh * 2, 0xff3333);
  }

  update(dt, playerSpeed) {
    this.x += (ENEMY_SPEED - playerSpeed) * dt;
    if (this.x < -GAME_WIDTH) this.x = -GAME_WIDTH;
    this.rect.setPosition(this.x, this.y);
  }

  trackY(playerY) {
    this.y = playerY;
  }

  destroy() {
    this.rect.destroy();
  }
}
