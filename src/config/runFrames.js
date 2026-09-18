// Run-cycle frames for player and enemy (docs/image-assets.md "Run-cycle
// frames (player & enemy)"). Prepped with `tools/prep-run-frames.py` from
// source photos (or `--dummy N` for placeholders) into
// public/assets/sprites/<target>/run-<i>.png at a uniform height (280px = 2x
// logical, matching obstacle sprites), a file naming convention rather than a
// manifest — see docs/run-sprite-prompt.md for the source-art prompt.
// `BootScene` preloads every entry in both lists.
import { PLAYER_FRAME_COUNT, ENEMY_FRAME_COUNT } from './gameConfig.js';

function frames(prefix, dir, count) {
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}-run-${i}`,
    file: `assets/sprites/${dir}/run-${i}.png`,
  }));
}

export const PLAYER_FRAMES = frames('player', 'player', PLAYER_FRAME_COUNT);
export const ENEMY_FRAMES = frames('enemy', 'enemy', ENEMY_FRAME_COUNT);
