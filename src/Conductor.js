import { BEAT_MS, FIRST_BEAT_OFFSET_MS } from './config/gameConfig.js';

// Minimal beat clock and the single read point for song time: polled once per
// frame by GameScene, consumed by anything that needs song time or beat
// crossings (score, spawner, enemy pacing, beat visuals). All beat-grid math
// goes through here — nothing else knows FIRST_BEAT_OFFSET_MS.
export class Conductor {
  constructor(music) {
    this.music = music;
    this.beatMs = BEAT_MS;
    this.songMs = 0;
    this.beatTimeMs = -FIRST_BEAT_OFFSET_MS; // song time relative to game beat 0
    this.beatIndex = -1;
    this.halfBeatIndex = -1;
    this.beatCrossed = false;
    this.halfBeatCrossed = false;
  }

  update() {
    this.songMs = this.music.seek * 1000;
    this.beatTimeMs = this.songMs - FIRST_BEAT_OFFSET_MS;

    if (this.beatTimeMs < 0) {
      // Before the first beat — no crossings fire
      this.beatCrossed = false;
      this.halfBeatCrossed = false;
      return;
    }

    const beatIndex = this.gridIndex(1);
    const halfBeatIndex = this.gridIndex(2);

    // Any index change counts, so a loop restart (indices jump backwards)
    // registers as a crossing too
    this.beatCrossed = beatIndex !== this.beatIndex;
    this.halfBeatCrossed = halfBeatIndex !== this.halfBeatIndex;
    this.beatIndex = beatIndex;
    this.halfBeatIndex = halfBeatIndex;
  }

  // Index of the current cell on a grid with `divisionsPerBeat` cells per beat
  // (1 = beats, 2 = 8th notes, 0.25 = bars)
  gridIndex(divisionsPerBeat) {
    return Math.floor((this.beatTimeMs * divisionsPerBeat) / this.beatMs);
  }

  // Milliseconds into the current `periodBeats`-long cycle, always in [0, period)
  phaseMs(periodBeats) {
    const period = this.beatMs * periodBeats;
    return ((this.beatTimeMs % period) + period) % period;
  }
}
