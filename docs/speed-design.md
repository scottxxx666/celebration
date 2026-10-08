# Speed & Chase Design

How the chase and on-beat obstacle arrival work, and the math behind the tuning
knobs in `src/config/gameConfig.js`.

## Core idea

The chasing enemy pins the player into a narrow speed band near max. Once the player is
forced into that band, obstacle spawn timing can assume the band's average speed and
obstacles arrive on the beat within roughly ±30–40 ms (inside a typical rhythm-game
"Perfect" window). Speed is the defense against the enemy; rows are the defense against
obstacles.

## How it works

### 1. Enemy chase speed: song-anchored ramp

- The enemy starts at `ENEMY_SPEED` (400) and lerps linearly to `ENEMY_CRUISE_SPEED`
  (565) between `ENEMY_RAMP_START_MS` (real beat 12, mid-intro) and `ENEMY_RAMP_END_MS`
  (real beat 36, so chorus 1 hits at cruise) — see `Enemy.update()`.
- The ramp runs on song time (`conductor.songMs`, the same clock as wave spawning), not
  wall-clock time, so pause and tab-blur keep enemy pressure in sync with the music.
- The enemy is clamped at the left screen edge; touching it gives no speed boost.

### 2. Obstacle motion & spawn timing: two phases

Obstacles **always scroll at the player's current speed**. Only the *spawn-time
calculation* (`travelMs` in `ObstacleSpawner.update()`) changes phase:

- **Before `OBSTACLE_TIMING_SWITCH_MS`** (sparse intro): `travelMs` uses the player's
  current speed at spawn. Obstacles may arrive off-tempo; acceptable because the intro
  is authored sparse.
- **From `OBSTACLE_TIMING_SWITCH_MS`**: `travelMs` uses `OBSTACLE_TIMING_SPEED` — the
  average of the forced band, `(MAX_SPEED + ENEMY_CRUISE_SPEED) / 2` (582.5). The player
  is pinned in the band, so real arrival error stays small.

The switch is its own song-time constant, set to when the ramp completes — it does not
read `enemy.speed`, so the two can be tuned independently. `GameScene` also multiplies
the timing speed by the section's `speedMult`.

### 3. Taps are never judged against the beat

Taps always give full accel — the game stays a running game, and rhythm is conveyed
world-side (the beat-sync layer from `BEAT_SYNC_START_MS`). The equilibrium math below
therefore needs no timing-window term.

## Tuning math

Track: 150.55 BPM (`TRACK_BPM`), so a quarter note is ~398.5 ms = 2.51 taps/s.

With tap gain `ACCEL_STEP` (50), decay `DECEL_PER_SEC` (125), and cap `MAX_SPEED` (600):

- Sustainable average speed at tap rate `r` (taps/sec, for r ≥ DECEL/ACCEL = 2.5):
  `avg = MAX_SPEED − DECEL_PER_SEC / (2r)`
- Below 2.5 taps/s speed decays toward `MIN_SPEED` — the cap creates the band.
- Quarter-note tapping (2.51 taps/s) sits just above that threshold and sustains ~575.
- `ENEMY_CRUISE_SPEED` = 565 is ~10 px/s below that, so on-rhythm tapping slowly regrows
  the gap (avoids the "walking dead" state where an early mistake is unrecoverable).
- **Rule of thumb:** keep `ENEMY_CRUISE_SPEED` slightly *below* the sustainable average
  at the intended musical tap cadence, so on-rhythm play escapes and mistakes shrink the
  gap. The gap becomes a visible skill meter.

Re-run this if `ACCEL_STEP`, `DECEL_PER_SEC`, `MAX_SPEED` or the track changes.

## Config

| Variable | Meaning | Value |
|---|---|---|
| `ENEMY_SPEED` | enemy speed before the ramp | 400 |
| `ENEMY_CRUISE_SPEED` | enemy speed after the ramp | 565 |
| `ENEMY_RAMP_START_MS` / `ENEMY_RAMP_END_MS` | song-time span of the ramp | 5331 / 14896 |
| `OBSTACLE_TIMING_SPEED` | assumed speed for spawn timing after the switch | `(MAX_SPEED + ENEMY_CRUISE_SPEED) / 2` |
| `OBSTACLE_TIMING_SWITCH_MS` | song time when spawn timing switches phase | 14896 |
| `BPM` / `FIRST_BEAT_OFFSET_MS` | game beat grid (measured 2026-09-18, see `tools/gen-waves.py`) | 150.55 / 2143 |
