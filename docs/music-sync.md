# Plan: Music-Synced Wave Spawning

## Context
`waves.js` already has authored obstacle sequences with `timeOffset` per obstacle, but `ObstacleSpawner` ignores it and still does random, timer-based spawning. The goal is to:
1. Anchor the wave sequence to a real music track
2. Use the audio clock (not game timer) as the master clock
3. Spawn obstacles so they **arrive** at the player on the beat, not just spawn on the beat

Patterns targeted: beat-synced spawning (#1), section-based difficulty (#2), near-miss on accent (#3).

---

## Files to Change

| File | Change |
|---|---|
| `src/config/waves.js` | Add `songTime` (ms) to each wave; add `type: "accent"` to near-miss obstacles |
| `src/objects/ObstacleSpawner.js` | Replace random spawning with wave-driven, audio-clock-based logic |
| `src/scenes/GameScene.js` | Load + play audio; pass audio reference to spawner |
| `src/scenes/BootScene.js` | Preload the audio asset |

---

## Step 1 — `waves.js`: Add `songTime` and `type`

Each wave gets a `songTime` field = absolute ms from song start when that wave begins.  
Obstacles that should be near-misses get `type: "accent"`.

```
{ songTime: 0,    name: 'intro',             duration: 5600, obstacles: [...] }
{ songTime: 5600, name: 'high_low_alternation', duration: 5600, obstacles: [...] }
{ songTime: 11200, name: 'gap_run',          duration: 7000, obstacles: [...] }
```

The `songTime` values must align with real musical phrases in the chosen track.  
Use a tool like **Sonic Visualiser** or **BPMAnalyzer** to find section boundaries.

---

## Step 2 — `ObstacleSpawner.js`: Wave-driven, audio-clocked spawning

### Core logic change

Replace the `SPAWN_INTERVAL_MS` timer with this per-frame logic:

```
audioMs = audio.seek * 1000          // master clock (never drifts)

for each wave in WAVES:
  for each obstacle in wave.obstacles:
    arrivalMs  = wave.songTime + obstacle.timeOffset
    travelMs   = travelDuration(speed, obstacle.hw)  // distance / speed
    spawnMs    = arrivalMs - travelMs

    if audioMs >= spawnMs and not yet spawned:
      spawn obstacle at (GAME_WIDTH + hw, obstacle.y, obstacle.hw, obstacle.hh)
      mark as spawned
```

### Travel duration

```
distance    = GAME_WIDTH + hw - PLAYER_X   // spawn X to player X
travelMs    = (distance / speed) * 1000    // using speed at spawn moment
```

Speed is variable, so timing won't be perfect if speed changes mid-flight. This is acceptable for a variable-speed game. Use current speed at the moment of spawn.

### Near-miss (accent) obstacles

If `obstacle.type === "accent"`, spawn the obstacle at the player's current y, regardless of the authored `y`. This creates a "close call" on strong beats.

### Spawned tracking

Keep a `Set` of spawned obstacle identifiers (e.g. `waveIndex_obstacleIndex`) so each obstacle is only spawned once per playthrough.

---

## Step 3 — `GameScene.js`: Load audio, pass to spawner

- In `BootScene.preload()`: `this.load.audio('music', 'assets/music.mp3')`
- In `GameScene.create()`: `this.music = this.sound.add('music'); this.music.play()`
- Pass `this.music` to `ObstacleSpawner` constructor
- Spawner reads `this.audio.seek * 1000` each frame instead of Phaser's `time`

---

## Step 4 — Choose and prepare the music track

Requirements for the track:
- Constant BPM (or known section BPMs)
- Clear section boundaries to align with waves
- Preferably 30–60s to cover current 3-wave sequence (~18.2s total)

After choosing, find:
- First beat offset (songs rarely start exactly at 0.0s)
- BPM → beat interval ms = `60000 / BPM`
- Section start times → map to `songTime` in `waves.js`

Then adjust `timeOffset` values in `waves.js` to land on actual beats.

---

## Verification

1. `yarn dev` → confirm audio plays on game start
2. Slow the game speed to near-minimum; confirm obstacles still arrive at player near their beat (not just spawn on beat)
3. Check `accent` obstacles feel like close calls on strong downbeats
4. Confirm no obstacle spawns twice (Set tracking)
5. Confirm wave 2 doesn't start before wave 1 finishes (no overlap in `songTime + duration`)
