# Architecture Review — Music-Synced Freerunning Game

Date: 2026-07-05. Reviewed: all of `src/` + `docs/music-sync.md`, `docs/music.md`, `docs/art-brief.md`.
This is a concept/plan document — no code. Each issue lists fix options; the recommended one is marked.
Implementation order suggestion is at the bottom.

Context: the game's goal is that gameplay tempo follows the song ("dance game" feel). The
audio-clock wave spawning from `docs/music-sync.md` is implemented in `ObstacleSpawner`.

Update 2026-07-07: resolved issues removed from this doc —
**C1/C2** (variable speed vs. on-beat arrival; enemy boundary-boost ratchet) via the speed-band
design in `docs/speed-design.md` (song-anchored enemy ramp to `ENEMY_CRUISE_SPEED`, two-phase
spawn timing with `OBSTACLE_TIMING_SPEED`); **C3** (autoplay desync) via `MenuScene`, which waits
for the audio unlock before starting `GameScene`; **M1** (missing Phaser import in spawner),
**M3** (game-over path extracted to `endRun()`), **M5** (CLAUDE.md refreshed).

Update 2026-07-07 (ambient beat-sync MVP), resolved issues removed —
**M8** (enemy row-snap): the enemy now steps onto the player's row only on beat crossings
(`Enemy.trackRow`); instant tracking remains during the intro. **A2** (beat-judged taps):
closed by design decision — the game stays a running game; taps are never judged against the
beat. Rhythm is conveyed world-side instead: `src/Conductor.js` (minimal polled beat clock,
beat/half-beat crossings), enemy row-stepping, the player's 8th-note squash pulse, and a
walk-zone beat flash, all switching on together at `BEAT_SYNC_START_MS` (song time, decoupled
from the enemy speed ramp). This is A1 in its minimal form; A1 stays open below for the
remaining scope (beats-authored waves, latency offset, centralizing clock reads).

Update 2026-07-07 (cleanups), resolved issues removed —
**A3** (player dimensions duplicated): `Player.js` now imports `PLAYER_HW`/`PLAYER_HH` from
`gameConfig.js` (Option A); the local `HALF_W`/`HALF_H` constants and the "must match" comment
are gone. **A5** (fake-3D depth): `src/rowLayout.js` (Option A) maps row → `{y, scale, depth}`
(scale 60%→100% per the art brief, `ROW_SCALE_BACK`/`ROW_SCALE_FRONT` in config) and creates
drop-shadow ellipses; player, enemy, and obstacles apply `setDepth(row)` (shadows at row − 0.5,
background layers pushed below) and are scaled visually — collision boxes are unchanged. The
duplicated row→y math moved into the helper too. The player's beat squash now composes with the
row scale via a separate squash factor.

Update 2026-07-07 (wave data model), resolved issues removed —
**A4** (visual-only `hh`): wave obstacles now use `visualHh` (drawn size only) plus an optional
`rows: n` (default 1) that expands collision to n consecutive rows — one visual + one collision
box (rows stay uniformly spaced in y, so a single unscaled AABB spanning n rows is exact; the
visual anchors on the front-most covered row for correct fake-3D occlusion). Row-quantized
collision was kept deliberately: rows are the collision model, `visualHh` is the art. The
`gap_run` walls stay 1-row blockers by design decision — no gameplay change.

---

## Architecture Improvements (for the dance-game goal)

### A1. Beat abstraction is minimal — wave authoring is still raw milliseconds

**Where (current state):** `src/Conductor.js` exists as a minimal polled beat clock
(`beatMs` from `BPM`, beat/half-beat crossing flags) consumed by `GameScene` for the ambient
beat-sync layer. But `waves.js` still hardcodes ms (`5600`, `700`, `1400` — 700 ms = one beat
at 85.7 BPM), `ObstacleSpawner` still reads `music.seek` directly, and there is no latency
calibration.

**Remaining scope:**

- Author waves in **beats** (`{ beat: 8, row: 0, … }`) and convert via the Conductor —
  swapping songs becomes changing `BPM` + `FIRST_BEAT_OFFSET_MS`, not rewriting every number.
  Do this before authoring a full track's waves.
- Centralize clock reads: `ObstacleSpawner` (and `Enemy`'s ramp) should get song time from the
  Conductor instead of touching `music.seek` themselves, so an `AUDIO_LATENCY_OFFSET_MS`
  calibration constant can be added in one place.
- Beat/bar *events* (vs. polled flags) only if a consumer outside `GameScene.update` needs
  them — YAGNI so far.

### A6. Two clocks: score/gameplay uses game time, obstacles use audio time

**Where:** `GameScene.update()` scores by `time − startTime` (Phaser clock); spawner runs on
`music.seek`. The music loops but `WAVES` covers only ~18.2 s, so if the track is longer than
the waves there is dead air; when the loop restarts, waves replay (the `spawned` reset on
seek-backwards handles this).

**Problem:** Not a bug today, but pause, tab-blur (Phaser pauses the sound, game clock choices
differ), and "song position" UI all get confusing with two time bases. Also the song-loop /
survival-score combination is an undecided design: is a run "one song = one level" or endless?

**Options:**

- **Option A — Recommended:** make the Conductor's song time the *only* gameplay clock (score,
  waves, enemy pacing). Decide: **song = level** — when the track ends, that's a clear/win
  screen; death before the end shows progress %. This matches the dance-game framing and makes
  wave authoring finite and meaningful.
- **Option B:** endless mode — keep looping, keep survival-seconds score, and make waves cycle
  with escalating modifiers (denser obstacles per loop). Fine as a mode later; harder to author
  well.

---

## Minor / Cleanup

- **M2. Dead config:** `SPAWN_INTERVAL_MS` is unused since wave-driven spawning landed. Delete.
- **M4. Spawner scans all waves × obstacles every frame.** Harmless at this size; if waves grow
  to a full song, keep a cursor index per wave (events are already required to be sorted). Only
  do this when authoring a full track (YAGNI until then).
- **M6. Single audio format:** `music.m4a` only. Fine for modern browsers; optionally provide
  `.ogg` fallback via Phaser's multi-URL audio load if you ever hit a codec complaint.
- **M7. `GameOverScene` restart replays from song start** — expected, but once "song = level"
  (A6-A) is chosen, also show progress % reached, not just seconds.

---

## Suggested Implementation Order (for the follow-up agent)

1. **A1** remaining scope: beats-authored waves + centralized clock reads (do before authoring
   a full track)
2. **A6 Option A** single clock + song-as-level decision
3. **M2** cleanup
