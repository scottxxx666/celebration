# Speed & Chase Design — Decisions

Date: 2026-07-07. Resolves C1/C2 from `architecture-review.md` with the chosen concept.
Concept only — no code yet.

## Core idea

The chasing enemy pins the player into a narrow speed band near max. Once the player is
forced into that band, obstacle spawn timing can assume the band's average speed and
obstacles arrive on the beat within ±30–45 ms (inside a typical rhythm-game "Perfect"
window). Speed is the defense against the enemy; rows are the defense against obstacles.

## Decisions

### 1. Enemy chase speed: song-anchored ramp, tunable cruise

- Enemy starts at `ENEMY_SPEED` (400) and ramps up to `ENEMY_CRUISE_SPEED`,
  **anchored to song time** (e.g. reach cruise at a given `songTime` / section start),
  stepping per bar or lerping over a few bars — never an instant jump.
- `ENEMY_CRUISE_SPEED` is a **config variable** so difficulty can be tuned by hand.
  Starting suggestion: ~575 (see tuning math below for why not 580).
- **Remove** the current boundary-touch boost in `Enemy.update()`
  (`if atBoundary → speed = MAX_SPEED − 20`). The boundary clamp itself stays.

### 2. Obstacle motion & spawn timing: two phases

Obstacles **always scroll at the player's current speed** (unchanged from today).
Only the *spawn-time calculation* changes phase:

- **Before the enemy reaches cruise speed** (easy intro): compute `travelMs` from the
  player's current speed at spawn — current behavior. Obstacles may arrive off-tempo;
  acceptable because the intro is authored sparse (few or no obstacles).
- **After the enemy reaches cruise speed**: compute `travelMs` from
  `OBSTACLE_TIMING_SPEED` — the average of the forced band, ≈ `(MAX_SPEED + ENEMY_CRUISE_SPEED) / 2`
  (~587 at current numbers). Player is pinned in the band, so real arrival error stays
  within ±30–45 ms of the beat.
- Switch condition: `enemy.speed >= ENEMY_CRUISE_SPEED` (simple boolean; no blending).

### 3. Ramp trigger uses song time

The ramp schedule is defined against the audio clock (same clock as wave spawning),
not wall-clock/game time. Pause and tab-blur then keep enemy pressure in sync with
the music, and the ramp can be authored to land on a musical build-up.

### 4. BPM is undecided — keep it a variable

- Add config variables now (values TBD): `BPM`, `FIRST_BEAT_OFFSET_MS`.
- When the track/BPM is chosen, re-derive wave `timeOffset`s and the ramp schedule
  from beats, and re-run the tuning math below.

## Tuning math (revisit when BPM is chosen)

With tap gain `ACCEL_STEP` (50), decay `DECEL_PER_SEC` (125), and cap `MAX_SPEED` (600):

- Sustainable average speed at tap rate `r` (taps/sec, for r ≥ DECEL/ACCEL = 2.5):
  `avg = MAX_SPEED − DECEL_PER_SEC / (2r)`
- Below 2.5 taps/s speed decays toward `MIN_SPEED` — the cap creates the band.
- Required tap rate to hold a given enemy cruise speed `E`:
  `r = DECEL_PER_SEC / (2 × (MAX_SPEED − E))`
  - E = 580 → 3.13 taps/s (between 8th notes and triplets at ~86 BPM — unmusical)
  - E = 575 → 2.50 taps/s minimum; 8th notes at 86 BPM (2.86/s) sustain ~578 → small
    escape margin, so perfect rhythmic tapping slowly regrows the gap (avoids the
    "walking dead" state where an early mistake is unrecoverable)
- **Rule of thumb:** pick `ENEMY_CRUISE_SPEED` slightly *below* the sustainable average
  at the intended musical tap cadence (e.g. 8th notes), so on-rhythm play escapes and
  mistakes shrink the gap. The gap becomes a visible skill meter.
- Beat-judged taps were considered and **rejected** (2026-07-07): taps always give full
  accel — the game stays a running game, and rhythm is conveyed world-side (beat-sync layer
  from `BEAT_SYNC_START_MS`). The equilibrium math above therefore stands as-is.

## Config additions (names indicative)

| Variable | Meaning | Initial value |
|---|---|---|
| `ENEMY_CRUISE_SPEED` | enemy speed after ramp completes | ~575 (tune) |
| `ENEMY_RAMP` | song-time schedule for the ramp (start/end songTime or per-section) | TBD with track |
| `OBSTACLE_TIMING_SPEED` | assumed speed for spawn timing after ramp | `(MAX_SPEED + ENEMY_CRUISE_SPEED) / 2` |
| `BPM` | track BPM | TBD |
| `FIRST_BEAT_OFFSET_MS` | offset of first beat in the audio file | TBD |

## Open items

1. Choose the track → set `BPM`, `FIRST_BEAT_OFFSET_MS`.
2. Decide the ramp anchor points (which section/bar reaches cruise).
3. Author the intro waves sparse (ramp phase tolerates off-tempo arrivals).
4. Tune `ENEMY_CRUISE_SPEED` by feel; keep it just below the sustainable average.
