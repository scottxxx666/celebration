import {
  ENEMY_SPEED,
  ENEMY_HW,
  ENEMY_HH,
  ENEMY_SPRITE_HH,
  ENEMY_CRUISE_SPEED,
  ENEMY_RAMP_START_MS,
  ENEMY_RAMP_END_MS,
  RUN_FRAME_MS,
  NUM_ROWS,
} from '../config/gameConfig.js';
import { ENEMY_FRAMES } from '../config/runFrames.js';
import { rowLayout } from '../rowLayout.js';
import { RunCycle } from './RunCycle.js';

export class Enemy {
  constructor(scene, x) {
    this.hw = ENEMY_HW;
    this.hh = ENEMY_HH;
    this.x = x;
    this.row = Math.floor(NUM_ROWS / 2);
    this.targetRow = this.row;
    this.atBoundary = false;
    this.speed = ENEMY_SPEED;
    this.runCycle = new RunCycle(scene, ENEMY_FRAMES, {
      spriteHh: ENEMY_SPRITE_HH,
      hw: ENEMY_HW,
      hh: ENEMY_HH,
      fallbackColor: 0xff3333,
      frameMs: RUN_FRAME_MS,
    });
    this._applyRow();
  }

  // speedMult scales motion only (from the section layer); the ramp itself
  // (and the ENEMY_CRUISE_SPEED check GameScene runs against this.speed) stays untouched
  update(dt, playerSpeed, songMs, speedMult = 1) {
    const progress = Math.min(
      1,
      Math.max(0, (songMs - ENEMY_RAMP_START_MS) / (ENEMY_RAMP_END_MS - ENEMY_RAMP_START_MS))
    );
    this.speed = ENEMY_SPEED + (ENEMY_CRUISE_SPEED - ENEMY_SPEED) * progress;
    this.x += (this.speed - playerSpeed) * speedMult * dt;
    this.atBoundary = this.x < -ENEMY_HW;
    if (this.atBoundary) {
      this.x = -ENEMY_HW;
    }
    this.runCycle.update(dt * 1000);
    this.runCycle.layout(this.x, this.y, this.scale, this.depth);
  }

  // Tracks the player's row instantly while beat sync is off (intro); once it's
  // on, steps onto the row only on a beat crossing — row-dodging then buys the
  // player up to one beat of separation
  trackRow(playerRow, beatCrossed, beatSyncOn) {
    this.targetRow = playerRow;
    if ((beatCrossed || !beatSyncOn) && this.row !== this.targetRow) {
      this.row = this.targetRow;
      this._applyRow();
    }
  }

  _applyRow() {
    const { y, scale, depth } = rowLayout(this.row);
    this.y = y;
    this.scale = scale;
    this.depth = depth;
    this.runCycle.layout(this.x, y, scale, depth);
  }

  // Forwarders — GameScene calls these on the enemy without knowing about
  // the run cycle underneath.
  stepFrame() {
    this.runCycle.stepFrame();
  }

  pulse() {
    this.runCycle.pulse();
  }

  destroy() {
    this.runCycle.destroy();
  }
}
