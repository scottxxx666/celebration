import Phaser from 'phaser';
import {
  ENEMY_SPEED,
  ENEMY_HW,
  ENEMY_HH,
  ENEMY_SPRITE_HH,
  ENEMY_CRUISE_SPEED,
  ENEMY_RAMP_START_MS,
  ENEMY_RAMP_END_MS,
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
    this.speed = ENEMY_SPEED;
    this.runCycle = new RunCycle(scene, ENEMY_FRAMES, {
      spriteHh: ENEMY_SPRITE_HH,
      hw: ENEMY_HW,
      hh: ENEMY_HH,
      fallbackColor: 0xff3333,
    });
    this._setRow(Math.floor(NUM_ROWS / 2));
  }

  // speedMult scales motion only (from the section layer); the ramp itself is
  // anchored to song time
  update(dt, playerSpeed, songMs, speedMult = 1) {
    const progress = Phaser.Math.Clamp(
      (songMs - ENEMY_RAMP_START_MS) / (ENEMY_RAMP_END_MS - ENEMY_RAMP_START_MS),
      0,
      1
    );
    this.speed = ENEMY_SPEED + (ENEMY_CRUISE_SPEED - ENEMY_SPEED) * progress;
    this.x = Math.max(-ENEMY_HW, this.x + (this.speed - playerSpeed) * speedMult * dt);
    this.runCycle.update(dt * 1000);
    this.runCycle.layout(this.x, this.y, this.scale, this.depth);
  }

  // Tracks the player's row instantly while beat sync is off (intro); once it's
  // on, steps onto the row only on a beat crossing — row-dodging then buys the
  // player up to one beat of separation
  trackRow(playerRow, beatCrossed, beatSyncOn) {
    if ((beatCrossed || !beatSyncOn) && this.row !== playerRow) {
      this._setRow(playerRow);
    }
  }

  _setRow(row) {
    this.row = row;
    const { y, scale, depth } = rowLayout(row);
    this.y = y;
    this.scale = scale;
    this.depth = depth;
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
