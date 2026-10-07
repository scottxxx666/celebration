import { BEAT_MS } from '../config/gameConfig.js';
import { addShadow, styleShadow, fitSpriteScale } from '../rowLayout.js';

// Shared run-cycle visual: sprite (or fallback rectangle) + drop shadow, used
// by both Player and Enemy so each can carry its own frame set and step rate.
// Once the beat clock runs, GameScene calls syncFrame(walkIndex) each frame
// with the character's walk-grid index (stepsPerBeat x speedMult steps per
// beat) and the frame is derived from that index, so the phase is fixed by the
// beat grid. Before the first sync, a free-running timer in update() animates
// the walk at the same stepsPerBeat rate; it stops for good once beat-locked.
// With a non-zero tapIdleMs, step() takes the cycle over: each call advances
// one frame and holds it, and syncFrame()/the timer are ignored until
// tapIdleMs passes without another step(), when they resume.
export class RunCycle {
  constructor(scene, frames, { spriteHh, hw, hh, fallbackColor, stepsPerBeat, tapIdleMs = 0 }) {
    this.frames = frames;
    this.spriteHh = spriteHh;
    this.hh = hh;
    this.frameMs = BEAT_MS / stepsPerBeat; // pre-beat fallback frame period
    this.tapIdleMs = tapIdleMs;
    this._sinceStepMs = Infinity; // ms since the last step(); Infinity = never stepped

    this._frame = 0; // current frame index (only used when frames is non-empty)
    this._frameTimer = 0; // ms since the last frame step (pre-beat fallback)
    this._beatLocked = false; // set by the first syncFrame(); silences the timer
    this._squash = 1; // beat-pulse squash factor on top of the row scale
    this.shadowGlow = false; // lights-out: shadow glows above the blackout (see styleShadow)

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
    this._sinceStepMs += delta;
    if (!this._tapHeld() && !this._beatLocked) {
      this._frameTimer += delta;
      if (this._frameTimer >= this.frameMs) this._timerStep();
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
    this.shadow.setPosition(x, feetY).setScale(scale);
    styleShadow(this.shadow, depth, this.shadowGlow);
  }

  // Show the frame for a walk-grid index (index mod frame count) and lock out
  // the free-running timer. Safe to call every frame; a no-op on the frame when
  // frames is empty or while a recent step() holds the cycle.
  syncFrame(walkIndex) {
    this._beatLocked = true;
    if (this.frames.length === 0 || this._tapHeld()) return;
    this._showFrame(walkIndex % this.frames.length);
  }

  // Tap-driven mode: advance one frame (wrapping) and hold it against the
  // beat grid/timer for tapIdleMs. No-op when tapIdleMs is 0.
  step() {
    if (this.tapIdleMs <= 0) return;
    this._sinceStepMs = 0;
    this._nextFrame();
  }

  // True while the last step() is recent enough to own the frame.
  _tapHeld() {
    return this._sinceStepMs < this.tapIdleMs;
  }

  // Pre-beat fallback: advance one frame (wrapping) and restart the timer.
  _timerStep() {
    this._frameTimer = 0;
    this._nextFrame();
  }

  _nextFrame() {
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
