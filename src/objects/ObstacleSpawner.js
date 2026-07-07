import { GAME_WIDTH, PLAYER_X, ROW_HEIGHT, PLAYER_HH, NUM_ROWS } from '../config/gameConfig.js';
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
          this._spawnAt(obs.row, obs.hw, obs.visualHh, obs.rows ?? 1);
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

  // Blocks rows row … row + rows − 1 with one collision box; one visual anchored
  // on the front-most covered row (its scale/depth), so it draws over the rows it
  // covers and under the rows in front of it.
  _spawnAt(row, hw, visualHh, rows = 1) {
    const front = Math.min(row + rows - 1, NUM_ROWS - 1);
    const { y: frontY, scale, depth } = rowLayout(front);
    const x = GAME_WIDTH + hw;
    // Base-anchored: the bottom edge sits on the front row's feet line (same line as
    // the player's feet/shadow), so shadow position always shows the blocked row(s);
    // tall art extends upward, even past the walk zone into scenery.
    const visualY = frontY + (PLAYER_HH - visualHh) * scale;
    // Collision box spans exactly the covered rows: centered between the first and
    // last covered row, with the single-row margin (PLAYER_HH + hh < ROW_HEIGHT)
    // preserved so adjacent rows are never clipped.
    const collisionY = (rowLayout(row).y + frontY) / 2;
    const collisionHh = ((rows - 1) * ROW_HEIGHT) / 2 + (ROW_HEIGHT - PLAYER_HH - 1);
    // Obstacles get a darker shadow than the player so the ground contact —
    // which marks the blocked row — reads at a glance despite tall art.
    const shadow = addShadow(this.scene, hw, 0.5)
      .setPosition(x, visualY + visualHh * scale)
      .setScale(scale)
      .setDepth(depth - 0.5);
    const rect = this.scene.add
      .rectangle(x, visualY, hw * 2, visualHh * 2, 0xff4444)
      .setScale(scale)
      .setDepth(depth);
    this.obstacles.push({ rect, shadow, x, y: collisionY, hw, hh: collisionHh });
  }

  destroyAll() {
    this.obstacles.forEach(obs => {
      obs.rect.destroy();
      obs.shadow.destroy();
    });
    this.obstacles = [];
  }
}
