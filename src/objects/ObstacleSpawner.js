import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SPAWN_INTERVAL_MS, WALK_ZONE_TOP } from '../config/gameConfig.js';

export class ObstacleSpawner {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // { rect, x, y, hw, hh }
    this.lastSpawn = 0;
  }

  update(time, speed, delta) {
    const dt = delta / 1000;

    if (time - this.lastSpawn > SPAWN_INTERVAL_MS) {
      this._spawn();
      this.lastSpawn = time;
    }

    this.obstacles = this.obstacles.filter(obs => {
      obs.x -= speed * dt;
      obs.rect.setX(obs.x);
      if (obs.x + obs.hw < 0) {
        obs.rect.destroy();
        return false;
      }
      return true;
    });
  }

  _spawn() {
    const hw = Phaser.Math.Between(15, 35);
    const hh = Phaser.Math.Between(15, 50);
    const y = Phaser.Math.Between(WALK_ZONE_TOP + hh, GAME_HEIGHT - hh);
    const x = GAME_WIDTH + hw;

    const rect = this.scene.add.rectangle(x, y, hw * 2, hh * 2, 0xff4444);
    this.obstacles.push({ rect, x, y, hw, hh });
  }

  destroyAll() {
    this.obstacles.forEach(obs => obs.rect.destroy());
    this.obstacles = [];
  }
}
