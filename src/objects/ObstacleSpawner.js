import { GAME_WIDTH, PLAYER_X } from '../config/gameConfig.js';
import { WAVES } from '../config/waves.js';

export class ObstacleSpawner {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.obstacles = []; // { rect, x, y, hw, hh }
    this.spawned = new Set(); // "waveIdx_obsIdx"
    this.lastAudioMs = 0;
  }

  update(time, speed, delta) {
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
        const travelMs = (distance / speed) * 1000;
        if (audioMs >= arrivalMs - travelMs) {
          this._spawnAt(obs.y, obs.hw, obs.hh);
          this.spawned.add(key);
        }
      }
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

  _spawnAt(y, hw, hh) {
    const x = GAME_WIDTH + hw;
    const rect = this.scene.add.rectangle(x, y, hw * 2, hh * 2, 0xff4444);
    this.obstacles.push({ rect, x, y, hw, hh });
  }

  destroyAll() {
    this.obstacles.forEach(obs => obs.rect.destroy());
    this.obstacles = [];
  }
}
