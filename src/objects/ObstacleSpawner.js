import { GAME_WIDTH, PLAYER_X, ROW_HEIGHT, PLAYER_HH } from '../config/gameConfig.js';
import { WAVES } from '../config/waves.js';
import { OBSTACLE_SPRITES } from '../config/obstacleSprites.js';
import { rowLayout, addShadow } from '../rowLayout.js';

export class ObstacleSpawner {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // { rect, x, y, hw, hh }
    this.spawned = new Set(); // "waveIdx_obsIdx"
  }

  // Deterministic sprite pick for wave `wi`, obstacle index `oi` — avoids
  // repeating the previous obstacle's sprite within the same wave (when
  // there's more than one to choose from) so consecutive obstacles read as
  // different characters.
  spriteFor(wi, oi) {
    if (OBSTACLE_SPRITES.length === 0) return null;
    const index = (wi * 7 + oi) % OBSTACLE_SPRITES.length;
    if (oi > 0 && OBSTACLE_SPRITES.length >= 2) {
      const prevIndex = (wi * 7 + oi - 1) % OBSTACLE_SPRITES.length;
      if (index === prevIndex) {
        return OBSTACLE_SPRITES[(index + 1) % OBSTACLE_SPRITES.length];
      }
    }
    return OBSTACLE_SPRITES[index];
  }

  // songMs: song time from the Conductor; speed: actual scroll speed;
  // timingSpeed: assumed speed for on-beat spawn timing
  update(songMs, speed, delta, timingSpeed) {
    const dt = delta / 1000;

    for (let wi = 0; wi < WAVES.length; wi++) {
      const wave = WAVES[wi];
      for (let oi = 0; oi < wave.obstacles.length; oi++) {
        const key = `${wi}_${oi}`;
        if (this.spawned.has(key)) continue;
        const obs = wave.obstacles[oi];
        const sprite = this.spriteFor(wi, oi);
        const hw = sprite ? sprite.hw : obs.hw;
        const arrivalMs = wave.songTime + obs.timeOffset;
        const distance = GAME_WIDTH + hw - PLAYER_X;
        const travelMs = (distance / timingSpeed) * 1000;
        if (songMs >= arrivalMs - travelMs) {
          this._spawnAt(obs.row, hw, obs.visualHh, sprite);
          this.spawned.add(key);
        }
      }
    }

    this.obstacles = this.obstacles.filter(obs => {
      obs.x -= speed * dt;
      obs.rect.setX(obs.sprite ? obs.x - obs.hw : obs.x);
      obs.shadow.setX(obs.x);
      if (obs.x + obs.hw < 0) {
        obs.rect.destroy();
        obs.shadow.destroy();
        return false;
      }
      return true;
    });
  }

  // Dev deep-link (?t=): mark every obstacle whose arrival is at or before
  // songMs as already spawned, so jumping forward doesn't dump a pile of
  // obstacles on the first frame. Obstacles arriving shortly after songMs still
  // spawn normally next frame (they're spawned ahead of arrival by travel time).
  skipTo(songMs) {
    for (let wi = 0; wi < WAVES.length; wi++) {
      const wave = WAVES[wi];
      for (let oi = 0; oi < wave.obstacles.length; oi++) {
        const arrivalMs = wave.songTime + wave.obstacles[oi].timeOffset;
        if (arrivalMs <= songMs) this.spawned.add(`${wi}_${oi}`);
      }
    }
  }

  _spawnAt(row, hw, visualHh, sprite) {
    const { y, scale, depth } = rowLayout(row);
    const x = GAME_WIDTH + hw;
    // Base-anchored: the bottom edge sits on the row's feet line (same line as
    // the player's feet/shadow), so shadow position always shows the blocked row;
    // tall art extends upward, even past the walk zone into scenery.
    const feetY = y + PLAYER_HH * scale;
    const visualY = y + (PLAYER_HH - visualHh) * scale;
    // Collision uses the row-center y and a hh that strictly blocks only one row:
    // PLAYER_HH + collisionHh < ROW_HEIGHT → collisionHh < ROW_HEIGHT - PLAYER_HH = 19
    const collisionHh = ROW_HEIGHT - PLAYER_HH - 1;
    // Obstacles get a darker shadow than the player so the ground contact —
    // which marks the blocked row — reads at a glance despite tall art.
    const shadow = addShadow(this.scene, hw, 0.5)
      .setPosition(x, feetY)
      .setScale(scale)
      .setDepth(depth - 0.5);

    let rect;
    if (sprite) {
      // Origin (0, 1): left edge on the collision box's left edge (x - hw),
      // bottom edge on the feet line — same anchoring the shadow uses.
      rect = this.scene.add
        .image(x - hw, feetY, sprite.key)
        .setOrigin(0, 1)
        .setDepth(depth);
      const texHeight = rect.height;
      rect.setScale((sprite.hh * 2 / texHeight) * scale);
    } else {
      // Fallback placeholder when no character sprites are configured.
      rect = this.scene.add
        .rectangle(x, visualY, hw * 2, visualHh * 2, 0xff4444)
        .setScale(scale)
        .setDepth(depth);
    }
    this.obstacles.push({ rect, shadow, sprite, x, y, hw, hh: collisionHh });
  }

  destroyAll() {
    this.obstacles.forEach(obs => {
      obs.rect.destroy();
      obs.shadow.destroy();
    });
    this.obstacles = [];
  }
}
