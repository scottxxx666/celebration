import { WALL_LINE_TOP, STATION_DEPTH, STATION_WIDTH, STATION_IMAGE } from '../config/gameConfig.js';
import { stationX, STATION_BOTTOM } from '../stationBuilding.js';

// A subway entrance whose left side is the wall (see src/stationBuilding.js), its front covering everything right
// of the wall down past the screen bottom: one preloaded image placed in local coordinates (x from the wall's left
// edge, top at the wall's cap height), so a frame only moves it. Gone from the impact on.
export class StationBuilding {
  constructor(scene) {
    this.image = scene.add.image(0, WALL_LINE_TOP, STATION_IMAGE.key)
      .setOrigin(0, 0)
      .setDisplaySize(STATION_WIDTH, STATION_BOTTOM - WALL_LINE_TOP)
      .setDepth(STATION_DEPTH)
      .setVisible(false);
  }

  update(songMs) {
    const x = stationX(songMs);
    this.image.setVisible(x !== null);
    if (x !== null) this.image.setX(x);
  }
}
