import { AUDIO_LATENCY_OFFSET_MS, BEAT_MS, FIRST_BEAT_OFFSET_MS, TRACK_BEAT_MS } from './config/gameConfig.js';

const trackBeatMs = TRACK_BEAT_MS;
// FIRST_BEAT_OFFSET_MS sits on real beat 4 in the numbering of tools/gen-waves.py (real beat 0 = first downbeat)
const OFFSET_REAL_BEAT = 4;
// A new output-latency reading replaces the adopted one only when it differs by
// more than this, so a wobbling estimate doesn't jitter the whole game clock
const LATENCY_HYSTERESIS_MS = 10;

const latencyTermMs = (seconds) => (Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0);

// Nearest real track beat (always TRACK_BPM, whatever half-time BPM is set) to
// `ms`. Pure, for offline tools like the beat checker.
export function snapToTrackBeat(ms) {
  return FIRST_BEAT_OFFSET_MS + Math.round((ms - FIRST_BEAT_OFFSET_MS) / trackBeatMs) * trackBeatMs;
}

// Real-beat number (gen-waves.py numbering) of the nearest track beat to `ms`.
export function trackBeatOf(ms) {
  return Math.round((ms - FIRST_BEAT_OFFSET_MS) / trackBeatMs) + OFFSET_REAL_BEAT;
}

// Minimal beat clock and the single read point for song time: polled once per
// frame by GameScene, consumed by anything that needs song time or beat
// crossings (score, spawner, enemy pacing, beat visuals). All beat-grid math
// goes through here — nothing else knows FIRST_BEAT_OFFSET_MS. Song time is
// what the player hears: the audio engine's scheduled position minus the output
// latency (auto-detected, plus the AUDIO_LATENCY_OFFSET_MS trim) — nothing else
// knows about latency either.
export class Conductor {
  constructor(music, latencyTrimMs = AUDIO_LATENCY_OFFSET_MS) {
    this.music = music;
    this.latencyTrimMs = latencyTrimMs;
    this.detectedLatencyMs = null; // adopted reading; null until the first update
    this.latencyMs = latencyTrimMs; // adopted total (detected + trim), for debugging
    this.beatMs = BEAT_MS;
    this.songMs = 0;
    this.beatTimeMs = -FIRST_BEAT_OFFSET_MS; // song time relative to game beat 0
    this.beatIndex = -1;
    this.halfBeatIndex = -1;
    this.beatCrossed = false;
    this.halfBeatCrossed = false;
  }

  update() {
    // Re-read every frame so an output device switch mid-run is picked up.
    // No context (HTML5 / no-audio sound manager) reads as zero latency
    const context = this.music.manager?.context;
    const detected = latencyTermMs(context?.baseLatency) + latencyTermMs(context?.outputLatency);
    if (
      this.detectedLatencyMs === null ||
      Math.abs(detected - this.detectedLatencyMs) > LATENCY_HYSTERESIS_MS
    ) {
      this.detectedLatencyMs = detected;
      this.latencyMs = detected + this.latencyTrimMs;
    }

    this.songMs = this.music.seek * 1000 - this.latencyMs;
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
