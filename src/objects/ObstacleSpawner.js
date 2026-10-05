import { GAME_WIDTH, PLAYER_X, MIN_SPEED, ROW_HEIGHT, PLAYER_HH, TRACK_BEAT_MS } from '../config/gameConfig.js';
import { WAVES } from '../config/waves.js';
import { OBSTACLE_SPRITES } from '../config/obstacleSprites.js';
import { rowLayout, addShadow, fitSpriteScale } from '../rowLayout.js';

// Deterministic sprite pick for wave `wi`, obstacle index `oi` — avoids
// repeating the previous obstacle's sprite within the same wave (when
// there's more than one to choose from) so consecutive obstacles read as
// different characters.
export function spriteFor(wi, oi) {
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

// Collision uses the row-center y and a hh that strictly blocks only one row:
// PLAYER_HH + collisionHh < ROW_HEIGHT → collisionHh < ROW_HEIGHT - PLAYER_HH = 19
const COLLISION_HH = ROW_HEIGHT - PLAYER_HH - 1;

// Half-width of the placeholder rectangle (half-height is PLAYER_HH), used only
// when no character sprites are configured.
const FALLBACK_HW = 25;

// Every obstacle is spawned ahead of its arrival by its travel time; this is
// the longest travel any obstacle can have (widest hitbox at MIN_SPEED), so
// the per-frame scan only needs to look this far ahead of the cursor.
const MAX_HW = Math.max(FALLBACK_HW, ...OBSTACLE_SPRITES.map(s => s.hw));
const MAX_TRAVEL_MS = ((GAME_WIDTH + MAX_HW - PLAYER_X) / MIN_SPEED) * 1000;

export class ObstacleSpawner {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // live { rect, shadow, sprite, x, y, hw, hh }

    // Authored waves flattened once into arrival order, sprite/hitbox resolved
    // up front; `next` is the first entry that hasn't spawned yet.
    this.pending = [];
    WAVES.forEach((wave, wi) => {
      wave.obstacles.forEach((obs, oi) => {
        const sprite = spriteFor(wi, oi);
        this.pending.push({
          arrivalMs: wave.songTime + obs.timeOffset * TRACK_BEAT_MS, // timeOffset is in real track beats
          row: obs.row,
          hw: sprite ? sprite.hw : FALLBACK_HW,
          sprite,
          spawned: false,
        });
      });
    });
    this.pending.sort((a, b) => a.arrivalMs - b.arrivalMs);
    this.next = 0;
  }

  // songMs: song time from the Conductor; speed: actual scroll speed;
  // timingSpeed: assumed speed for on-beat spawn timing
  update(songMs, speed, delta, timingSpeed) {
    // Spawn everything due within the lookahead window (wider obstacles are
    // due slightly earlier than narrower ones with the same arrival, so the
    // window is scanned rather than just the head)
    for (let i = this.next; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.arrivalMs - songMs > MAX_TRAVEL_MS) break;
      if (p.spawned) continue;
      const travelMs = ((GAME_WIDTH + p.hw - PLAYER_X) / timingSpeed) * 1000;
      if (songMs >= p.arrivalMs - travelMs) {
        this._spawn(p);
        p.spawned = true;
      }
    }
    while (this.next < this.pending.length && this.pending[this.next].spawned) this.next++;

    const dx = speed * (delta / 1000);
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= dx;
      obs.rect.setX(obs.sprite ? obs.x - obs.hw : obs.x);
      obs.shadow.setX(obs.x);
      if (obs.x + obs.hw < 0) {
        obs.rect.destroy();
        obs.shadow.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  // Dev deep-link (?t=): mark every obstacle whose arrival is at or before
  // songMs as already spawned, so jumping forward doesn't dump a pile of
  // obstacles on the first frame. Obstacles arriving shortly after songMs still
  // spawn normally next frame (they're spawned ahead of arrival by travel time).
  skipTo(songMs) {
    while (this.next < this.pending.length && this.pending[this.next].arrivalMs <= songMs) {
      this.pending[this.next].spawned = true;
      this.next++;
    }
  }

  _spawn({ row, hw, sprite }) {
    const { y, scale, depth } = rowLayout(row);
    const x = GAME_WIDTH + hw;
    // Base-anchored: the bottom edge sits on the row's feet line (same line as
    // the player's feet/shadow), so shadow position always shows the blocked row;
    // tall art extends upward, even past the walk zone into scenery.
    const feetY = y + PLAYER_HH * scale;
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
      rect = this.scene.add.image(x - hw, feetY, sprite.key).setOrigin(0, 1).setDepth(depth);
      rect.setScale(fitSpriteScale(rect, sprite.hh, scale));
    } else {
      // Fallback placeholder when no character sprites are configured.
      rect = this.scene.add
        .rectangle(x, y, hw * 2, PLAYER_HH * 2, 0xff4444)
        .setScale(scale)
        .setDepth(depth);
    }
    this.obstacles.push({ rect, shadow, sprite, x, y, hw, hh: COLLISION_HH });
  }

  destroyAll() {
    this.obstacles.forEach(obs => {
      obs.rect.destroy();
      obs.shadow.destroy();
    });
    this.obstacles = [];
  }
}
