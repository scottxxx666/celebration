import {
  GAME_HEIGHT, WALL_LINE_TOP,
  STATION_DEPTH, STATION_WIDTH, STATION_FACADE_COLOR, STATION_JOINT_COLOR, STATION_TILE_PX, STATION_PANEL_PX,
  STATION_ROOF_COLOR, STATION_ROOF_HEIGHT,
  STATION_WINDOW_COLOR, STATION_WINDOW_LIT_COLOR, STATION_WINDOW_YS, STATION_WINDOW_W, STATION_WINDOW_H, STATION_WINDOW_STEP,
  STATION_BAND_Y, STATION_BAND_H, STATION_BAND_COLOR, STATION_SHADE_TOP, STATION_SHADE_ALPHA,
  STATION_PLINTH_COLOR, STATION_PLINTH_HEIGHT, STATION_KERB_COLOR,
  STATION_DOOR_X, STATION_DOOR_W, STATION_DOOR_TOP, STATION_DOOR_COLOR, STATION_STAIR_COLOR, STATION_STAIR_COUNT,
  STATION_CANOPY_OVERHANG, STATION_CANOPY_Y, STATION_CANOPY_H, STATION_CANOPY_COLOR, STATION_TUBE_COLOR,
  STATION_SPILL_COLOR, STATION_SPILL_ALPHA,
  STATION_SIGN_W, STATION_SIGN_H, STATION_SIGN_Y, STATION_SIGN_COLOR, STATION_SIGN_FRAME_COLOR, STATION_GLYPH_COLOR,
  STATION_MAP_XS, STATION_MAP_Y, STATION_MAP_W, STATION_MAP_H, STATION_MAP_COLOR, STATION_MAP_LINE_COLORS,
} from '../config/gameConfig.js';
import { stationX, STATION_BOTTOM } from '../stationBuilding.js';

const TOP = WALL_LINE_TOP;                         // roof level with the wall's cap, so the wall reads as the building's side
const PLINTH_TOP = GAME_HEIGHT - STATION_PLINTH_HEIGHT;
const SHADE_STEPS = 8;                             // the ground-floor darkening is drawn in this many bands

// A subway entrance whose left side is the wall (see src/stationBuilding.js), its front covering everything right
// of the wall down past the screen bottom: one Graphics drawn once in local coordinates (x from the wall's left
// edge), so a frame only moves it. Gone from the impact on.
export class StationBuilding {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(STATION_DEPTH).setVisible(false);
    this.draw();
  }

  draw() {
    const g = this.g;
    const W = STATION_WIDTH;
    const doorR = STATION_DOOR_X + STATION_DOOR_W;

    // Tiled concrete facade: tile courses plus vertical panel seams, down to the plinth
    g.fillStyle(STATION_FACADE_COLOR).fillRect(0, TOP, W, PLINTH_TOP - TOP);
    g.fillStyle(STATION_JOINT_COLOR);
    for (let y = TOP + STATION_ROOF_HEIGHT + STATION_TILE_PX; y < PLINTH_TOP; y += STATION_TILE_PX) g.fillRect(0, y, W, 1);
    for (let x = STATION_PANEL_PX; x < W; x += STATION_PANEL_PX) g.fillRect(x, TOP, 1, PLINTH_TOP - TOP);

    // Flat roof: parapet with a lit top edge, and its shadow line on the facade
    g.fillStyle(STATION_ROOF_COLOR).fillRect(0, TOP, W, STATION_ROOF_HEIGHT);
    g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.35).fillRect(0, TOP, W, 1);
    g.fillStyle(0x000000, 0.25).fillRect(0, TOP + STATION_ROOF_HEIGHT, W, 3);

    // Window slits, one row per upper floor
    for (const wy of STATION_WINDOW_YS) {
      for (let x = 30; x + STATION_WINDOW_W < W; x += STATION_WINDOW_STEP) {
        g.fillStyle(STATION_WINDOW_COLOR).fillRect(x, wy, STATION_WINDOW_W, STATION_WINDOW_H);
        g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.5).fillRect(x, wy + STATION_WINDOW_H - 1, STATION_WINDOW_W, 1);
      }
    }

    // String course between the upper floors and the ground floor: lit top edge, shadow under it
    g.fillStyle(STATION_BAND_COLOR).fillRect(0, STATION_BAND_Y, W, STATION_BAND_H);
    g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.25).fillRect(0, STATION_BAND_Y, W, 1);
    g.fillStyle(0x000000, 0.22).fillRect(0, STATION_BAND_Y + STATION_BAND_H, W, 3);

    // Ground floor darkens toward the plinth
    const shadeH = (PLINTH_TOP - STATION_SHADE_TOP) / SHADE_STEPS;
    for (let i = 0; i < SHADE_STEPS; i++) {
      g.fillStyle(0x000000, (STATION_SHADE_ALPHA * (i + 1)) / SHADE_STEPS)
        .fillRect(0, STATION_SHADE_TOP + i * shadeH, W, Math.ceil(shadeH));
    }

    // Backlit route-map panels either side of the doorway: frame, panel, a few generic route lines with stops
    for (const mx of STATION_MAP_XS) {
      g.fillStyle(STATION_SIGN_FRAME_COLOR).fillRect(mx - 3, STATION_MAP_Y - 3, STATION_MAP_W + 6, STATION_MAP_H + 6);
      g.fillStyle(STATION_MAP_COLOR).fillRect(mx, STATION_MAP_Y, STATION_MAP_W, STATION_MAP_H);
      g.fillStyle(STATION_GLYPH_COLOR).fillRect(mx, STATION_MAP_Y, STATION_MAP_W, 9);
      STATION_MAP_LINE_COLORS.forEach((color, k) => {
        const y0 = STATION_MAP_Y + 22 + k * 22;
        const pts = [[mx + 8, y0], [mx + 26, y0], [mx + 40, y0 + (k === 1 ? -14 : 12)], [mx + STATION_MAP_W - 8, y0 + (k === 1 ? -14 : 12)]];
        g.lineStyle(3, color);
        for (let p = 1; p < pts.length; p++) g.lineBetween(pts[p - 1][0], pts[p - 1][1], pts[p][0], pts[p][1]);
        g.fillStyle(0xffffff);
        for (const [px, py] of pts) g.fillCircle(px, py, 2);
      });
      g.fillStyle(0xffffff, 0.18).fillRect(mx - 3, STATION_MAP_Y + STATION_MAP_H + 3, STATION_MAP_W + 6, 2);
    }

    // Cold light spill from the canopy tube: two soft cones down the facade either side of the doorway
    const cx0 = STATION_DOOR_X - STATION_CANOPY_OVERHANG;
    const cx1 = doorR + STATION_CANOPY_OVERHANG;
    const tubeY = STATION_CANOPY_Y + STATION_CANOPY_H;
    for (const [spread, alpha] of [[34, STATION_SPILL_ALPHA * 0.5], [14, STATION_SPILL_ALPHA]]) {
      g.fillStyle(STATION_SPILL_COLOR, alpha).fillPoints([
        { x: cx0 + 10, y: tubeY }, { x: cx1 - 10, y: tubeY },
        { x: cx1 + spread, y: PLINTH_TOP }, { x: cx0 - spread, y: PLINTH_TOP },
      ], true);
    }

    // Stairwell opening down to the plinth: dark doorway (drawn over the spill, so it stays a black hole), treads
    // widening and brightening toward the street
    const doorH = PLINTH_TOP - STATION_DOOR_TOP;
    g.fillStyle(STATION_DOOR_COLOR).fillRect(STATION_DOOR_X, STATION_DOOR_TOP, STATION_DOOR_W, doorH + STATION_PLINTH_HEIGHT);
    for (let i = 0; i < STATION_STAIR_COUNT; i++) {
      const f = i / STATION_STAIR_COUNT;              // 0 = nearest tread (bottom), 1 = deepest
      const inset = 8 + f * 34;
      const y = GAME_HEIGHT - 6 - i * (GAME_HEIGHT - 6 - STATION_DOOR_TOP - 24) / STATION_STAIR_COUNT;
      g.fillStyle(STATION_STAIR_COLOR, 1 - f * 0.9).fillRect(STATION_DOOR_X + inset, y, STATION_DOOR_W - 2 * inset, 3);
      g.fillStyle(STATION_SPILL_COLOR, STATION_SPILL_ALPHA * (1 - f)).fillRect(STATION_DOOR_X + inset, y, STATION_DOOR_W - 2 * inset, 1);
    }
    // Handrails down both sides
    g.lineStyle(2, STATION_WINDOW_LIT_COLOR, 0.45)
      .lineBetween(STATION_DOOR_X + 6, GAME_HEIGHT - 20, STATION_DOOR_X + 40, STATION_DOOR_TOP + 22)
      .lineBetween(doorR - 6, GAME_HEIGHT - 20, doorR - 40, STATION_DOOR_TOP + 22);
    // Door jambs: lit reveal on the left, shadowed on the right (light from the upper left)
    g.fillStyle(STATION_WINDOW_LIT_COLOR, 0.3).fillRect(STATION_DOOR_X - 3, STATION_DOOR_TOP, 3, doorH);
    g.fillStyle(0x000000, 0.35).fillRect(doorR, STATION_DOOR_TOP, 3, doorH);

    // Overhanging canopy slab with the fluorescent tube under it
    g.fillStyle(0x000000, 0.3).fillRect(cx0, tubeY, cx1 - cx0, 4);
    g.fillStyle(STATION_CANOPY_COLOR).fillRect(cx0, STATION_CANOPY_Y, cx1 - cx0, STATION_CANOPY_H);
    g.fillStyle(STATION_ROOF_COLOR).fillRect(cx0, STATION_CANOPY_Y, cx1 - cx0, 2);
    g.fillStyle(STATION_TUBE_COLOR).fillRect(cx0 + 12, tubeY - 2, cx1 - cx0 - 24, 2);

    // Lit sign panel over the canopy: frame, glow, a down arrow and block-letter bars (no real brand)
    const signX = STATION_DOOR_X + (STATION_DOOR_W - STATION_SIGN_W) / 2;
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
    const bracketH = STATION_CANOPY_Y - STATION_SIGN_Y - STATION_SIGN_H - 2;
    g.fillStyle(STATION_SIGN_FRAME_COLOR)
      .fillRect(signX + 14, STATION_SIGN_Y + STATION_SIGN_H + 2, 2, bracketH)
      .fillRect(signX + STATION_SIGN_W - 16, STATION_SIGN_Y + STATION_SIGN_H + 2, 2, bracketH);

    // Plinth along the bottom of the screen, broken by the doorway: lit kerb edge on top
    for (const [x0, x1] of [[0, STATION_DOOR_X], [doorR, W]]) {
      g.fillStyle(STATION_PLINTH_COLOR).fillRect(x0, PLINTH_TOP, x1 - x0, STATION_BOTTOM - PLINTH_TOP);
      g.fillStyle(STATION_KERB_COLOR).fillRect(x0, PLINTH_TOP, x1 - x0, 2);
      g.fillStyle(0x000000, 0.3).fillRect(x0, PLINTH_TOP + 2, x1 - x0, 2);
    }
    // The tube's light catches the kerb in front of the entrance
    g.fillStyle(STATION_SPILL_COLOR, STATION_SPILL_ALPHA * 1.5).fillRect(cx0 - 30, PLINTH_TOP, cx1 - cx0 + 60, 2);
  }

  update(songMs) {
    const x = stationX(songMs);
    this.g.setVisible(x !== null);
    if (x !== null) this.g.setX(x);
  }
}
