import { BPM, FIRST_BEAT_OFFSET_MS } from './config/gameConfig.js';

// Minimal beat clock and the single read point for song time: polled once per
// frame by GameScene, consumed by anything that needs song time or beat
// crossings (score, spawner, enemy pacing, beat visuals).
export class Conductor {
  constructor(music) {
    this.music = music;
    this.beatMs = 60000 / BPM;
    this.songMs = 0;
    this.beatIndex = -1;
    this.halfBeatIndex = -1;
    this.beatCrossed = false;
    this.halfBeatCrossed = false;
  }

  update() {
    this.songMs = this.music.seek * 1000;
    const songMs = this.songMs - FIRST_BEAT_OFFSET_MS;

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
