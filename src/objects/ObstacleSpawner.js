import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_X, WALK_ZONE_TOP, ROW_HEIGHT, PLAYER_HH } from '../config/gameConfig.js';
import { WAVES } from '../config/waves.js';
import { rowLayout, addShadow } from '../rowLayout.js';

export class ObstacleSpawner {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.obstacles = []; // { rect, x, y, hw, hh }
    this.spawned = new Set(); // "waveIdx_obsIdx"
    this.lastAudioMs = 0;
  }

  // speed: actual scroll speed; timingSpeed: assumed speed for on-beat spawn timing
  update(time, speed, delta, timingSpeed) {
    const dt = delta / 1000;
    const audioMs = this.audio.seek * 1000;

    if (audioMs < this.lastAudioMs) this.spawned.clear();
    this.lastAudioMs = audioMs;

    for (let wi = 0; wi < WAVES.length; wi++) {
      const wave = WAVES[wi];
      for (let oi = 0; oi < wave.obstacles.length; oi++) {
        const key = `${wi}_${oi}`;
        if (this.spawned.has(key)) continue;
        const obs = wave.obstacles[oi];
        const arrivalMs = wave.songTime + obs.timeOffset;
        const distance = GAME_WIDTH + obs.hw - PLAYER_X;
        const travelMs = (distance / timingSpeed) * 1000;
        if (audioMs >= arrivalMs - travelMs) {
          this._spawnAt(obs.row, obs.hw, obs.hh);
          this.spawned.add(key);
        }
      }
    }

    this.obstacles = this.obstacles.filter(obs => {
      obs.x -= speed * dt;
      obs.rect.setX(obs.x);
      obs.shadow.setX(obs.x);
      if (obs.x + obs.hw < 0) {
        obs.rect.destroy();
        obs.shadow.destroy();
        return false;
      }
      return true;
    });
  }

  _spawnAt(row, hw, visualHh) {
    const { y, scale, depth } = rowLayout(row);
    const x = GAME_WIDTH + hw;
    // Clamp visual center so the drawn (scaled) rectangle stays within the walking zone
    const visualY = Phaser.Math.Clamp(y, WALK_ZONE_TOP + visualHh * scale, GAME_HEIGHT - visualHh * scale);
    // Collision uses the row-center y and a hh that strictly blocks only one row:
    // PLAYER_HH + collisionHh < ROW_HEIGHT → collisionHh < ROW_HEIGHT - PLAYER_HH = 19
    const collisionHh = ROW_HEIGHT - PLAYER_HH - 1;
    const shadow = addShadow(this.scene, hw)
      .setPosition(x, visualY + visualHh * scale)
      .setScale(scale)
      .setDepth(depth - 0.5);
    const rect = this.scene.add
      .rectangle(x, visualY, hw * 2, visualHh * 2, 0xff4444)
      .setScale(scale)
      .setDepth(depth);
    this.obstacles.push({ rect, shadow, x, y, hw, hh: collisionHh });
  }

  destroyAll() {
    this.obstacles.forEach(obs => {
      obs.rect.destroy();
      obs.shadow.destroy();
    });
    this.obstacles = [];
  }
}
