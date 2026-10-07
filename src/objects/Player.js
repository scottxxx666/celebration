import Phaser from 'phaser';
import {
  GAME_WIDTH,
  MIN_SPEED,
  MAX_SPEED,
  ACCEL_STEP,
  DECEL_PER_SEC,
  NUM_ROWS,
  PLAYER_HW,
  PLAYER_HH,
  PLAYER_SPRITE_HH,
  PLAYER_RUN_STEPS_PER_BEAT,
  PLAYER_TAP_RUN_IDLE_MS,
  SWIPE_THRESHOLD,
  ENEMY_CRUISE_SPEED,
} from '../config/gameConfig.js';
import { PLAYER_FRAMES } from '../config/runFrames.js';
import { rowLayout } from '../rowLayout.js';
import { bindPointer, anyJustDown } from '../input.js';
import { RunCycle } from './RunCycle.js';
import { isDebugMode } from '../debugMode.js';


export class Player {
  constructor(scene, x) {
    this.x = x;
    this.debug = isDebugMode(); // `?debug`: speed pinned at the chaser's max
    this.speed = this.debug ? ENEMY_CRUISE_SPEED : MIN_SPEED; // world scroll speed (px/s)
    this.lastKey = null; // 'left' | 'right' — alternating-tap state

    this.runCycle = new RunCycle(scene, PLAYER_FRAMES, {
      spriteHh: PLAYER_SPRITE_HH,
      hw: PLAYER_HW,
      hh: PLAYER_HH,
      fallbackColor: 0x00ff88,
      stepsPerBeat: PLAYER_RUN_STEPS_PER_BEAT,
      // `?debug` ignores taps, so it keeps the beat-locked cycle
      tapIdleMs: this.debug ? 0 : PLAYER_TAP_RUN_IDLE_MS,
    });
    this._setRow(Math.floor(NUM_ROWS / 2)); // start in middle row
  }

  update(keys, delta) {
    // Fresh press (no auto-repeat) that alternates from lastKey → accelerate
    if (anyJustDown(keys.left)) this.tap('left');
    if (anyJustDown(keys.right)) this.tap('right');

    // Natural deceleration toward MIN_SPEED (skipped when debug pins the speed)
    if (!this.debug) this.speed = Math.max(MIN_SPEED, this.speed - DECEL_PER_SEC * (delta / 1000));

    // Vertical movement — snap to row on each key press
    if (anyJustDown(keys.up)) {
      this.moveRow(-1);
    } else if (anyJustDown(keys.down)) {
      this.moveRow(1);
    }

    this.runCycle.update(delta);
    this.runCycle.layout(this.x, this.y, this.scale, this.depth);
  }

  // Touch controls — tapping the left/right half of the screen is the
  // alternating accel (same path as the LEFT/RIGHT arrows and A/D); a vertical swipe
  // past SWIPE_THRESHOLD is a row change, one per pointer until release.
  // Tracked per pointer so two-thumb tapping and a swipe don't interfere.
  attachTouch(scene) {
    scene.input.addPointer(2);
    const gestures = new Map(); // pointer.id -> { startX, startY, rowChanged }
    bindPointer(scene, {
      down: (pointer) => {
        this.tap(pointer.x < GAME_WIDTH / 2 ? 'left' : 'right');
        gestures.set(pointer.id, { startX: pointer.x, startY: pointer.y, rowChanged: false });
      },
      move: (pointer) => {
        const gesture = gestures.get(pointer.id);
        if (!gesture || gesture.rowChanged) return;
        const dx = pointer.x - gesture.startX;
        const dy = pointer.y - gesture.startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
          this.moveRow(dy < 0 ? -1 : 1);
          gesture.rowChanged = true;
        }
      },
      up: (pointer) => gestures.delete(pointer.id),
    });
  }

  // Alternating tap: a press that differs from the last accelerates and
  // advances the run cycle one frame; a repeat of the same side does nothing.
  // Shared by keyboard and touch input.
  tap(side) {
    if (this.lastKey === side) return;
    if (!this.debug) this.speed = Math.min(this.speed + ACCEL_STEP, MAX_SPEED);
    this.lastKey = side;
    this.runCycle.step();
  }

  // Row snap, clamped to the walk zone. dir = -1 (up) or +1 (down).
  moveRow(dir) {
    this._setRow(Phaser.Math.Clamp(this.row + dir, 0, NUM_ROWS - 1));
  }

  _setRow(row) {
    this.row = row;
    const { y, scale, depth } = rowLayout(row);
    this.y = y;
    this.scale = scale;
    this.depth = depth;
  }

  // Forwarders — GameScene calls these on the player without knowing about
  // the run cycle underneath.
  syncFrame(walkIndex) {
    this.runCycle.syncFrame(walkIndex);
  }

  pulse() {
    this.runCycle.pulse();
  }

  setReveal(reveal) {
    this.runCycle.reveal = reveal;
  }

  // AABB overlap check against an obstacle { x, y, hw, hh }
  overlaps(obs) {
    return (
      Math.abs(this.x - obs.x) < PLAYER_HW + obs.hw &&
      Math.abs(this.y - obs.y) < PLAYER_HH + obs.hh
    );
  }
}
