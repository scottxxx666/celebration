import {
  WALK_ZONE_TOP, WALL_LINE_TOP,
  STATION_DEPTH, STATION_WIDTH, STATION_FACADE_COLOR, STATION_JOINT_COLOR, STATION_TILE_PX, STATION_PANEL_PX,
  STATION_ROOF_COLOR, STATION_ROOF_HEIGHT, STATION_PLINTH_COLOR, STATION_PLINTH_HEIGHT,
  STATION_WINDOW_COLOR, STATION_WINDOW_LIT_COLOR, STATION_WINDOW_Y, STATION_WINDOW_W, STATION_WINDOW_H, STATION_WINDOW_STEP,
  STATION_DOOR_X, STATION_DOOR_W, STATION_DOOR_TOP, STATION_DOOR_COLOR, STATION_STAIR_COLOR,
  STATION_CANOPY_OVERHANG, STATION_CANOPY_Y, STATION_CANOPY_H, STATION_CANOPY_COLOR, STATION_TUBE_COLOR,
  STATION_SPILL_COLOR, STATION_SPILL_ALPHA,
  STATION_SIGN_W, STATION_SIGN_H, STATION_SIGN_Y, STATION_SIGN_COLOR, STATION_SIGN_FRAME_COLOR, STATION_GLYPH_COLOR,
} from '../config/gameConfig.js';
import { stationX } from '../stationBuilding.js';

const TOP = WALL_LINE_TOP;      // roof level with the wall's cap, so the wall reads as the building's side
const BOTTOM = WALK_ZONE_TOP;   // stands on the ground behind the road
const SPILL_REACH = 26;         // the entrance light spills this far down onto the pavement/road

// A subway entrance whose left side is the wall (see src/stationBuilding.js): one Graphics drawn once in local
// coordinates (x from the wall's left edge), so a frame only moves it. Gone from the impact on.
export class StationBuilding {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(STATION_DEPTH).setVisible(false);
    this.draw();
  }

  draw() {
    const g = this.g;
    const W = STATION_WIDTH;

    // Tiled concrete facade: tile courses plus vertical panel seams
    g.fillStyle(STATION_FACADE_COLOR).fillRect(0, TOP, W, BOTTOM - TOP);
    g.fillStyle(STATION_JOINT_COLOR);
    for (let y = TOP + STATION_ROOF_HEIGHT + STATION_TILE_PX; y < BOTTOM; y += STATION_TILE_PX) g.fillRect(0, y, W, 1);
    for (let x = STATION_PANEL_PX; x < W; x += STATION_PANEL_PX) g.fillRect(x, TOP, 1, BOTTOM - TOP);

    // Flat roof: parapet with a lit top edge, and its shadow line on the facade
    g.fillStyle(STATION_ROOF_COLOR).fillRect(0, TOP, W, STATION_ROOF_HEIGHT);
    g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.35).fillRect(0, TOP, W, 1);
    g.fillStyle(0x000000, 0.25).fillRect(0, TOP + STATION_ROOF_HEIGHT, W, 3);

    // Window slits under the roof (skipping the stretch over the sign)
    const signX = STATION_DOOR_X + (STATION_DOOR_W - STATION_SIGN_W) / 2;
    for (let x = 30; x + STATION_WINDOW_W < W; x += STATION_WINDOW_STEP) {
      g.fillStyle(STATION_WINDOW_COLOR).fillRect(x, STATION_WINDOW_Y, STATION_WINDOW_W, STATION_WINDOW_H);
      g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.5).fillRect(x, STATION_WINDOW_Y + STATION_WINDOW_H - 1, STATION_WINDOW_W, 1);
    }

    // Stairwell opening: dark doorway, treads narrowing and fading as they go down into it
    const doorH = BOTTOM - STATION_DOOR_TOP;
    g.fillStyle(STATION_DOOR_COLOR).fillRect(STATION_DOOR_X, STATION_DOOR_TOP, STATION_DOOR_W, doorH);
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      const inset = 6 + f * 22;
      const y = BOTTOM - 4 - i * (doorH - 10) / steps;
      g.fillStyle(STATION_STAIR_COLOR, 1 - f * 0.85).fillRect(STATION_DOOR_X + inset, y, STATION_DOOR_W - 2 * inset, 2);
    }
    // Handrails down both sides
    g.lineStyle(1, STATION_WINDOW_LIT_COLOR, 0.45)
      .lineBetween(STATION_DOOR_X + 4, BOTTOM - 14, STATION_DOOR_X + 26, STATION_DOOR_TOP + 10)
      .lineBetween(STATION_DOOR_X + STATION_DOOR_W - 4, BOTTOM - 14, STATION_DOOR_X + STATION_DOOR_W - 26, STATION_DOOR_TOP + 10);

    // Cold light spill from the canopy tube: down over the doorway and out onto the pavement
    const cx0 = STATION_DOOR_X - STATION_CANOPY_OVERHANG;
    const cx1 = STATION_DOOR_X + STATION_DOOR_W + STATION_CANOPY_OVERHANG;
    const tubeY = STATION_CANOPY_Y + STATION_CANOPY_H;
    for (const [inset, alpha] of [[0, STATION_SPILL_ALPHA * 0.5], [14, STATION_SPILL_ALPHA]]) {
      g.fillStyle(STATION_SPILL_COLOR, alpha)
        .fillPoints([
          { x: cx0 + 10 + inset, y: tubeY }, { x: cx1 - 10 - inset, y: tubeY },
          { x: cx1 + 8 - inset, y: BOTTOM }, { x: cx0 - 8 + inset, y: BOTTOM },
        ], true)
        .fillPoints([
          { x: cx0 - 8 + inset, y: BOTTOM }, { x: cx1 + 8 - inset, y: BOTTOM },
          { x: cx1 + 14 - inset, y: BOTTOM + SPILL_REACH }, { x: cx0 - 14 + inset, y: BOTTOM + SPILL_REACH },
        ], true);
    }

    // Overhanging canopy slab with the fluorescent tube under it
    g.fillStyle(0x000000, 0.3).fillRect(cx0, tubeY, cx1 - cx0, 4);
    g.fillStyle(STATION_CANOPY_COLOR).fillRect(cx0, STATION_CANOPY_Y, cx1 - cx0, STATION_CANOPY_H);
    g.fillStyle(STATION_ROOF_COLOR).fillRect(cx0, STATION_CANOPY_Y, cx1 - cx0, 2);
    g.fillStyle(STATION_TUBE_COLOR).fillRect(cx0 + 12, tubeY - 2, cx1 - cx0 - 24, 2);

    // Lit sign panel over the canopy: frame, glow, a down arrow and block-letter bars (no real brand)
    g.fillStyle(STATION_SPILL_COLOR, 0.12).fillRect(signX - 6, STATION_SIGN_Y - 5, STATION_SIGN_W + 12, STATION_SIGN_H + 10);
    g.fillStyle(STATION_SIGN_FRAME_COLOR).fillRect(signX - 2, STATION_SIGN_Y - 2, STATION_SIGN_W + 4, STATION_SIGN_H + 4);
    g.fillStyle(STATION_SIGN_COLOR).fillRect(signX, STATION_SIGN_Y, STATION_SIGN_W, STATION_SIGN_H);
    const midY = STATION_SIGN_Y + STATION_SIGN_H / 2;
    g.fillStyle(STATION_GLYPH_COLOR)
      .fillRect(signX + 12, midY - 8, 4, 9)
      .fillTriangle(signX + 7, midY + 1, signX + 21, midY + 1, signX + 14, midY + 8);
    for (let k = 0; k < 4; k++) g.fillRect(signX + 30 + k * 14, midY - 5, 10, 10);
    g.fillStyle(STATION_SIGN_COLOR);
    // Cut-outs open to different edges so the blocks read as letters, not boxes
    for (const [k, dx, dy, w, h] of [[0, 3, -2, 7, 3], [1, 3, -5, 4, 3], [1, 3, 2, 7, 3], [2, 3, 0, 4, 5], [3, 3, -2, 4, 3]]) {
      g.fillRect(signX + 30 + k * 14 + dx, midY + dy, w, h);
    }
    // Mounting brackets down to the canopy
    g.fillStyle(STATION_SIGN_FRAME_COLOR)
      .fillRect(signX + 14, STATION_SIGN_Y + STATION_SIGN_H + 2, 2, STATION_CANOPY_Y - STATION_SIGN_Y - STATION_SIGN_H - 2)
      .fillRect(signX + STATION_SIGN_W - 16, STATION_SIGN_Y + STATION_SIGN_H + 2, 2, STATION_CANOPY_Y - STATION_SIGN_Y - STATION_SIGN_H - 2);

    // Dark base course along the ground, broken by the doorway
    g.fillStyle(STATION_PLINTH_COLOR)
      .fillRect(0, BOTTOM - STATION_PLINTH_HEIGHT, STATION_DOOR_X, STATION_PLINTH_HEIGHT)
      .fillRect(STATION_DOOR_X + STATION_DOOR_W, BOTTOM - STATION_PLINTH_HEIGHT, W - STATION_DOOR_X - STATION_DOOR_W, STATION_PLINTH_HEIGHT);
  }

  update(songMs) {
    const x = stationX(songMs);
    this.g.setVisible(x !== null);
    if (x !== null) this.g.setX(x);
  }
}
