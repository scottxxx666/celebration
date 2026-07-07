import { BPM, FIRST_BEAT_OFFSET_MS } from './config/gameConfig.js';

// Minimal beat clock: polled once per frame by GameScene, consumed by anything
// that needs to react on the beat (enemy row-stepping, beat visuals).
export class Conductor {
  constructor(music) {
    this.music = music;
    this.beatMs = 60000 / BPM;
    this.beatIndex = -1;
    this.halfBeatIndex = -1;
    this.beatCrossed = false;
    this.halfBeatCrossed = false;
  }

  update() {
    const songMs = this.music.seek * 1000 - FIRST_BEAT_OFFSET_MS;

    if (songMs < 0) {
      // Before the first beat — no crossings fire
      this.beatCrossed = false;
      this.halfBeatCrossed = false;
      return;
    }

    const beatIndex = Math.floor(songMs / this.beatMs);
    const halfBeatIndex = Math.floor(songMs / (this.beatMs / 2));

    // Any index change counts, so a loop restart (indices jump backwards)
    // registers as a crossing too
    this.beatCrossed = beatIndex !== this.beatIndex;
    this.halfBeatCrossed = halfBeatIndex !== this.halfBeatIndex;
    this.beatIndex = beatIndex;
    this.halfBeatIndex = halfBeatIndex;
  }
}
