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

### A3. Player dimensions duplicated between `gameConfig.js` and `Player.js`

**Where:** `PLAYER_HW`/`PLAYER_HH` in config carry a "must match Player.js HALF_W / HALF_H"
comment; `Player.js` re-declares 35/35 locally.

- **Option A — Recommended:** `Player.js` imports `PLAYER_HW`/`PLAYER_HH` from config; delete
  the local constants and the comment. Trivial, removes a real drift risk (the spawner's
  one-row collision math in `_spawnAt` depends on `PLAYER_HH` being right).
- **Option B:** move them onto the `Player` class as static fields and have the config/spawner
  import from Player. Same effect; pick one owner. Config is already the declared "single source
  of truth," so A.

### A4. Wave data model: `hh` is visual-only, collision is hardcoded to one row

**Where:** `waves.js` comment "hh is visual only; collision is always 1 row regardless";
`_spawnAt` derives `collisionHh = ROW_HEIGHT − PLAYER_HH − 1` and clamps a separate visual Y.

**Problem:** The field named like a collision half-height silently isn't one; the top/bottom
"walls" in `gap_run` (row 0 + row 4, hh 54) *look* like they block multiple rows but only block
one. A future author (or agent) editing waves will get this wrong.

**Options:**

- **Option A — Recommended:** rename the field to `visualHh` in wave data and spawner, and add
  an optional `rows: n` (default 1) that expands collision to n rows when a wall really should
  block several. Keeps the "collision = whole rows" simplification, makes the data honest.
- **Option B:** make collision honor real `hh` again (pure AABB, no row snapping). More
  flexible, but breaks the clean row-based dodge design you just built and makes near-miss
  authoring harder. Not recommended for this game.

### A5. Fake-3D depth (from art-brief) not implemented — plan for it now

**Where:** `docs/art-brief.md` promises scale-by-row (60%→100%) and engine drop shadows; the
code renders same-size rectangles with no depth ordering (creation order decides overlap, so an
obstacle in a back row can draw on top of the player standing in a front row).

**Options:**

- **Option A — Recommended:** introduce a tiny shared helper now (e.g. row → {y, scale, depth}):
  `depth = row` (or `y`) applied via `setDepth()` to player, enemy, obstacles; scale table per
  the art brief; a shadow ellipse under each object. Do it while everything is still rectangles
  so sprites drop in later without touching game logic.
- **Option B:** wait for real sprites and do depth+scale+shadows in one art pass. Less churn
  now, but current row overlap rendering is already visibly wrong in `gap_run`-style waves, and
  collision tuning (hw/hh vs. visual scale) is easier to settle before art lands.

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
3. **A3, A4, M2** cleanups
4. **A5** depth/scale/shadow helper (pre-art)
