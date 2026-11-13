import { GAME_WIDTH, WALL_BREAK_MS, STATION_WIDTH } from './config/gameConfig.js';
import { wallX, WALL_OFFSCREEN_PAD } from './wallBreak.js';

// Screen x of the station's left edge, or null when it isn't drawn. The building's left side is the wall
// (WallBreak), so it rides on wallX() — stateless from song time, `?t=` seeks just work — and is gone from
// the impact on (the stage cut to underground takes over, under the flash). Null while it is still past
// the right edge.
export function stationX(songMs) {
  if (songMs >= WALL_BREAK_MS) return null;
  const x = wallX(songMs);
  return x < GAME_WIDTH + WALL_OFFSCREEN_PAD && x + STATION_WIDTH > -WALL_OFFSCREEN_PAD ? x : null;
}
