// Player run-cycle frames (docs/image-assets.md "Player run frames").
// Prepped with `tools/prep-player-frames.py` from source photos (or
// `--dummy N` for placeholders) into public/assets/sprites/player/run-<i>.png
// at a uniform height (280px = 2x logical, matching obstacle sprites), a file
// naming convention rather than a manifest — see docs/player-sprite-prompt.md
// for the source-art prompt. `BootScene` preloads every entry here.
import { PLAYER_FRAME_COUNT } from './gameConfig.js';

export const PLAYER_FRAMES = Array.from({ length: PLAYER_FRAME_COUNT }, (_, i) => ({
  key: `player-run-${i}`,
  file: `assets/sprites/player/run-${i}.png`,
}));
