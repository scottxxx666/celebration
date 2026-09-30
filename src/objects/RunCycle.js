import { RUN_FRAME_MS } from '../config/gameConfig.js';
import { addShadow, fitSpriteScale } from '../rowLayout.js';

// Shared run-cycle visual: sprite (or fallback rectangle) + drop shadow, used
// by both Player and Enemy so each can carry its own frame set. Once the beat
// clock runs, GameScene calls syncFrame(halfBeatIndex) on each 8th-note
// (half-beat) crossing and the frame is derived from that index, so the phase
// is fixed by the beat grid. Before the first crossing, the free-running
// RUN_FRAME_MS timer in update() animates the walk; it stops for good once
// beat-locked.
export class RunCycle {
  constructor(scene, frames, { spriteHh, hw, hh, fallbackColor }) {
    this.frames = frames;
    this.spriteHh = spriteHh;
    this.hh = hh;

    this._frame = 0; // current frame index (only used when frames is non-empty)
    this._frameTimer = 0; // ms since the last frame step (pre-beat fallback)
    this._beatLocked = false; // set by the first syncFrame(); silences the timer
    this._squash = 1; // beat-pulse squash factor on top of the row scale

    this.shadow = addShadow(scene, hw);

    // Sprite mode (run-cycle frames) when configured; otherwise fall back to
    // the original placeholder rectangle. `this.sprite` holds whichever
    // visual object is in play.
    if (frames.length > 0) {
      this.sprite = scene.add.image(0, 0, frames[0].key).setOrigin(0.5, 1);
    } else {
      this.sprite = scene.add.rectangle(0, 0, hw * 2, hh * 2, fallbackColor);
    }
  }

  update(delta) {
    if (!this._beatLocked) {
      this._frameTimer += delta;
      if (this._frameTimer >= RUN_FRAME_MS) this._timerStep();
    }

    // Recover from the beat squash
    this._squash = Math.min(1, this._squash + 1.2 * (delta / 1000));
  }

  layout(x, y, scale, depth) {
    const feetY = y + this.hh * scale;
    if (this.frames.length > 0) {
      // Origin (0.5, 1): feet sit on the row's feet line — same point the
      // shadow is anchored at — so the beat squash shrinks toward the feet
      // for free.
      const spriteScale = fitSpriteScale(this.sprite, this.spriteHh, scale);
      this.sprite
        .setPosition(x, feetY)
        .setScale(spriteScale, spriteScale * this._squash)
        .setDepth(depth);
    } else {
      this.sprite
        .setPosition(x, y)
        .setScale(scale, scale * this._squash)
        .setDepth(depth);
    }
    this.shadow.setPosition(x, feetY).setScale(scale).setDepth(depth - 0.5);
  }

  // Show the frame for an 8th-note grid index (halfBeatIndex mod frame count)
  // and lock out the free-running timer. Called on 8th-note crossings; a no-op
  // on the frame when frames is empty.
  syncFrame(halfBeatIndex) {
    this._beatLocked = true;
    if (this.frames.length === 0) return;
    this._showFrame(halfBeatIndex % this.frames.length);
  }

  // Pre-beat fallback: advance one frame (wrapping) and restart the timer.
  _timerStep() {
    this._frameTimer = 0;
    if (this.frames.length === 0) return;
    this._showFrame((this._frame + 1) % this.frames.length);
  }

  _showFrame(index) {
    if (index === this._frame) return;
    this._frame = index;
    this.sprite.setTexture(this.frames[index].key);
  }

  // Squash on 8th notes — beat bounce synced to the music, only once the
  // beat-sync layer is on
  pulse() {
    this._squash = 0.85;
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
