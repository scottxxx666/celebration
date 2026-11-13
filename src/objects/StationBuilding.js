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
  STATION_WEAR_SEED, STATION_WEAR_JOINT_ALPHA, STATION_WEAR_BLEACH_TINT, STATION_WEAR_BLEACH_ALPHA,
  STATION_WEAR_BLEACH_PATCH_COUNT, STATION_WEAR_BLEACH_LIGHT, STATION_WEAR_BLEACH_DARK,
  STATION_WEAR_BLEACH_PATCH_ALPHA, STATION_WEAR_DUST_COLOR, STATION_WEAR_DUST_ALPHA, STATION_WEAR_DUST_BANDS,
  STATION_WEAR_GRAIN_COUNT, STATION_WEAR_GRAIN_LIGHT, STATION_WEAR_GRAIN_DARK, STATION_WEAR_GRAIN_ALPHA,
  STATION_WEAR_LEDGE_DUST_COLOR, STATION_WEAR_LEDGE_DUST_ALPHA, STATION_WEAR_PIT_COUNT, STATION_WEAR_PIT_COLOR,
  STATION_WEAR_PIT_ALPHA, STATION_WEAR_STRIP_COUNT, STATION_WEAR_STRIP_FLECKS, STATION_WEAR_STRIP_COLOR,
  STATION_WEAR_STRIP_ALPHA, STATION_WEAR_PEEL_COUNT, STATION_WEAR_PEEL_FRAGMENTS, STATION_WEAR_PEEL_COLOR,
  STATION_WEAR_PEEL_ALPHA, STATION_WEAR_PEEL_EDGE_COLOR, STATION_WEAR_CRACK_COUNT, STATION_WEAR_CRACK_SEGMENTS,
  STATION_WEAR_CRACK_COLOR, STATION_WEAR_CRACK_ALPHA, STATION_WEAR_SPALL_COLOR, STATION_WEAR_RUST_COLOR,
  STATION_WEAR_RUST_ALPHA, STATION_WEAR_RUST_MAX_PX, STATION_WEAR_FADE_COLOR, STATION_WEAR_SIGN_FADE_ALPHA,
  STATION_WEAR_MAP_FADE_ALPHA, STATION_WEAR_TOP_FADE_EXTRA, STATION_WEAR_DEAD_MAP, STATION_WEAR_DEAD_MAP_COLOR,
  STATION_WEAR_DEAD_SIGN_PX, STATION_WEAR_SAND_COLOR, STATION_WEAR_SAND_LIGHT, STATION_WEAR_SAND_SHADOW,
  STATION_WEAR_SAND_MAX_PX, STATION_WEAR_SAND_MIN_PX, STATION_WEAR_SAND_SPILL_PX, STATION_WEAR_SAND_LAYERS,
  STATION_WEAR_SAND_LAYER_ALPHA, STATION_WEAR_SAND_FADE_PX, STATION_WEAR_SAND_GRAIN, STATION_WEAR_SAND_RIPPLES,
  STATION_WEAR_STAIR_SAND_PX, STATION_WEAR_WEED_X, STATION_WEAR_WEED_R, STATION_WEAR_WEED_COLORS,
  STATION_WEAR_CRATE_X, STATION_WEAR_CRATE_W, STATION_WEAR_CRATE_H, STATION_WEAR_CRATE_COLOR,
} from '../config/gameConfig.js';
import { stationX, STATION_BOTTOM } from '../stationBuilding.js';

const TOP = WALL_LINE_TOP;                         // roof level with the wall's cap, so the wall reads as the building's side
const PLINTH_TOP = GAME_HEIGHT - STATION_PLINTH_HEIGHT;
const SHADE_STEPS = 8;
const CHIP_PX = 10;                                // spalled chip size at a corner or seam

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}                             // the ground-floor darkening is drawn in this many bands

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
    g.fillStyle(STATION_JOINT_COLOR, STATION_WEAR_JOINT_ALPHA);
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

    this.weather(signX, cx0, cx1);
  }

  // Desert wear laid over the finished facade, from a fixed seed so every run looks the same. Nothing is drawn
  // inside the doorway above its sand heap: rects are split around it and polygons rejected, so it stays a dark hole.
  weather(signX, cx0, cx1) {
    const g = this.g;
    const W = STATION_WIDTH;
    const doorR = STATION_DOOR_X + STATION_DOOR_W;
    const faceH = PLINTH_TOP - TOP;
    const rnd = mulberry32(STATION_WEAR_SEED);
    const between = (lo, hi) => lo + rnd() * (hi - lo);
    const inDoorX = (x0, x1) => x1 > STATION_DOOR_X && x0 < doorR;
    const clampX = x => Math.min(W, Math.max(0, x));
    // Rect clamped to the building width; below the doorway's top edge the part over the opening is left out
    const wear = (color, alpha, x, y, w, h) => {
      const x0 = clampX(x), x1 = clampX(x + w);
      if (x1 <= x0) return;
      g.fillStyle(color, alpha);
      if (!inDoorX(x0, x1) || y + h <= STATION_DOOR_TOP) { g.fillRect(x0, y, x1 - x0, h); return; }
      const hTop = STATION_DOOR_TOP - y;
      if (hTop > 0) g.fillRect(x0, y, x1 - x0, hTop);
      if (x0 < STATION_DOOR_X) g.fillRect(x0, Math.max(y, STATION_DOOR_TOP), STATION_DOOR_X - x0, h - Math.max(0, hTop));
      if (x1 > doorR) g.fillRect(doorR, Math.max(y, STATION_DOOR_TOP), x1 - doorR, h - Math.max(0, hTop));
    };
    // Irregular polygon around (cx, cy), offset by (ox, oy); false (and nothing drawn) if it would reach into the doorway
    const blob = (color, alpha, cx, cy, rx, ry, verts, jLo, jHi, ox = 0, oy = 0) => {
      if (inDoorX(cx - rx * jHi, cx + rx * jHi) && cy + ry * jHi > STATION_DOOR_TOP) return false;
      const pts = [];
      for (let v = 0; v < verts; v++) {
        const ang = (v / verts) * Math.PI * 2, j = between(jLo, jHi);
        pts.push({ x: clampX(cx + ox + Math.cos(ang) * rx * j), y: cy + oy + Math.sin(ang) * ry * j });
      }
      g.fillStyle(color, alpha).fillPoints(pts, true);
      return true;
    };
    const windX = () => W * Math.pow(rnd(), 2);                 // skewed toward the left (windward)
    const lowY = () => PLINTH_TOP - faceH * Math.pow(rnd(), 2.2); // skewed toward the ground
    const facadeTop = TOP + STATION_ROOF_HEIGHT;
    const mapZone = (x, y) => y > STATION_MAP_Y - 12 && y < STATION_MAP_Y + STATION_MAP_H + 12
      && STATION_MAP_XS.some(mx => x > mx - 16 && x < mx + STATION_MAP_W + 16);

    // Sun bleaching: a warm beige wash and very soft lighter / darker tonal drift
    wear(STATION_WEAR_BLEACH_TINT, STATION_WEAR_BLEACH_ALPHA, 0, facadeTop, W, faceH - STATION_ROOF_HEIGHT);
    for (let drawn = 0, tries = 0; drawn < STATION_WEAR_BLEACH_PATCH_COUNT && tries < 40; tries++) {
      const rx = between(60, 140), ry = between(35, 90), cx = between(rx, W - rx), cy = between(facadeTop + ry, PLINTH_TOP - ry);
      if (cy < STATION_CANOPY_Y && inDoorX(cx - rx - 40, cx + rx + 40)) continue; // not directly above the sign
      const color = drawn % 2 ? STATION_WEAR_BLEACH_LIGHT : STATION_WEAR_BLEACH_DARK;
      const alpha = STATION_WEAR_BLEACH_PATCH_ALPHA * between(0.6, 1.2);
      for (let k = 0; k < 3; k++) blob(color, alpha, cx, cy, rx * (1 - k * 0.2), ry * (1 - k * 0.2), 16, 0.55, 1.2, between(-12, 12), between(-8, 8));
      drawn++;
    }

    // Ochre dust film over the lower two thirds from many thin bands, thicker toward the ground
    const dustTop = TOP + faceH / 3;
    const bandH = (PLINTH_TOP - dustTop) / STATION_WEAR_DUST_BANDS;
    for (let i = 0; i < STATION_WEAR_DUST_BANDS; i++) {
      const f = (i + 1) / STATION_WEAR_DUST_BANDS;
      const y0 = Math.round(dustTop + i * bandH);
      wear(STATION_WEAR_DUST_COLOR, STATION_WEAR_DUST_ALPHA * Math.pow(f, 1.6), 0, y0, W, Math.round(dustTop + (i + 1) * bandH) - y0);
    }

    // Grain: seeded specks and short strokes in light and dark tones, denser low down
    for (let i = 0; i < STATION_WEAR_GRAIN_COUNT; i++) {
      const y = PLINTH_TOP - (faceH - STATION_ROOF_HEIGHT) * Math.pow(rnd(), 1.4);
      wear(rnd() < 0.5 ? STATION_WEAR_GRAIN_LIGHT : STATION_WEAR_GRAIN_DARK, STATION_WEAR_GRAIN_ALPHA * between(0.6, 1.4),
        between(0, W), y, rnd() < 0.3 ? between(2, 5) : between(1, 3), between(1, 2));
    }

    // Thin dust on ledges: parapet top, string course, canopy top and window sills, in broken runs
    const ledge = (x, y, w) => wear(STATION_WEAR_LEDGE_DUST_COLOR, STATION_WEAR_LEDGE_DUST_ALPHA, x, y - 2, w, 2);
    for (let x = 0; x < W; x += 30) {
      if (rnd() < 0.6) { ledge(x, TOP + 1, between(12, 30)); ledge(x, STATION_BAND_Y, between(12, 30)); }
    }
    ledge(cx0, STATION_CANOPY_Y, cx1 - cx0);
    for (const wy of STATION_WINDOW_YS) {
      for (let x = 30; x + STATION_WINDOW_W < W; x += STATION_WINDOW_STEP) if (rnd() < 0.6) ledge(x, wy + STATION_WINDOW_H, STATION_WINDOW_W);
    }

    // Sand-blasted pits and stripped-paint flecks, worst low and on the left
    for (let i = 0; i < STATION_WEAR_STRIP_COUNT; i++) {
      const cx = windX(), cy = lowY();
      for (let k = 0; k < STATION_WEAR_STRIP_FLECKS; k++) {
        wear(STATION_WEAR_STRIP_COLOR, STATION_WEAR_STRIP_ALPHA, cx + between(-20, 20), cy + between(-10, 10), between(2, 6), between(1, 3));
      }
    }
    for (let i = 0; i < STATION_WEAR_PIT_COUNT; i++) {
      const s = between(1, 2.5);
      wear(STATION_WEAR_PIT_COLOR, STATION_WEAR_PIT_ALPHA, windX(), lowY(), s, s);
    }

    // Peeling plaster: small clusters of ragged fragments, mostly low and on the left; shadow edge top/left, no pale lip
    for (let i = 0; i < STATION_WEAR_PEEL_COUNT; i++) {
      const cx = 20 + W * 0.45 * Math.pow(rnd(), 1.6), cy = between(PLINTH_TOP - 120, PLINTH_TOP - 30);
      if (mapZone(cx, cy) || (inDoorX(cx - 34, cx + 34) && cy + 20 > STATION_DOOR_TOP)) continue;
      for (let k = 0; k < STATION_WEAR_PEEL_FRAGMENTS; k++) {
        const a = between(0, Math.PI * 2), r = Math.sqrt(rnd()), fx = cx + Math.cos(a) * r * 40, fy = cy + Math.sin(a) * r * 22;
        const rx = between(2, 6), ry = between(1.5, 4.5);
        blob(STATION_WEAR_PEEL_EDGE_COLOR, 0.3, fx, fy, rx, ry, 7, 0.6, 1.2, -1, -1);
        blob(STATION_WEAR_PEEL_COLOR, STATION_WEAR_PEEL_ALPHA, fx, fy, rx, ry, 7, 0.6, 1.2);
      }
    }

    // Long thermal cracks
    for (let i = 0; i < STATION_WEAR_CRACK_COUNT; i++) {
      let x = between(10, W - 10), y = between(TOP + 20, PLINTH_TOP - 160);
      if (inDoorX(x - 60, x + 60) && y > STATION_DOOR_TOP - 180) continue;
      g.lineStyle(1, STATION_WEAR_CRACK_COLOR, STATION_WEAR_CRACK_ALPHA).beginPath().moveTo(x, y);
      for (let k = 0; k < STATION_WEAR_CRACK_SEGMENTS; k++) { x = clampX(x + between(-9, 9)); y += between(8, 16); g.lineTo(x, y); }
      g.strokePath();
    }
    // Chipped parapet corners and canopy ends
    for (const x of [0, W - CHIP_PX, cx0, cx1 - CHIP_PX]) {
      const y = x === cx0 || x === cx1 - CHIP_PX ? STATION_CANOPY_Y : TOP;
      g.fillStyle(STATION_WEAR_SPALL_COLOR, 0.45).fillRect(x, y, CHIP_PX, 3);
      g.fillStyle(STATION_WEAR_CRACK_COLOR, 0.35).fillTriangle(x, y + 3, x + CHIP_PX, y + 3, x + between(2, CHIP_PX - 2), y + 3 + between(4, 8));
    }

    // Sun-bleached signage: chalky haze, the upper half faded more, the right end of the sign and one map panel dead
    const chalk = (x, y, w, h, alpha) => {
      g.fillStyle(STATION_WEAR_FADE_COLOR, alpha).fillRect(x, y, w, h);
      g.fillStyle(STATION_WEAR_FADE_COLOR, STATION_WEAR_TOP_FADE_EXTRA).fillRect(x, y, w, h / 2);
    };
    chalk(signX, STATION_SIGN_Y, STATION_SIGN_W, STATION_SIGN_H, STATION_WEAR_SIGN_FADE_ALPHA);
    g.fillStyle(STATION_WEAR_DEAD_MAP_COLOR, 0.85)
      .fillRect(signX + STATION_SIGN_W - STATION_WEAR_DEAD_SIGN_PX, STATION_SIGN_Y, STATION_WEAR_DEAD_SIGN_PX, STATION_SIGN_H);
    STATION_MAP_XS.forEach((mx, i) => {
      if (i === STATION_WEAR_DEAD_MAP) {
        g.fillStyle(STATION_WEAR_DEAD_MAP_COLOR, 0.92).fillRect(mx, STATION_MAP_Y, STATION_MAP_W, STATION_MAP_H);
        g.lineStyle(1, STATION_WEAR_CRACK_COLOR, 0.6)
          .lineBetween(mx + 12, STATION_MAP_Y, mx + 36, STATION_MAP_Y + 40).lineBetween(mx + 36, STATION_MAP_Y + 40, mx + 28, STATION_MAP_Y + 70);
      } else {
        chalk(mx, STATION_MAP_Y, STATION_MAP_W, STATION_MAP_H, STATION_WEAR_MAP_FADE_ALPHA);
      }
    });

    // Short dry rust at the canopy ends and the sign brackets
    const canopyBottom = STATION_CANOPY_Y + STATION_CANOPY_H;
    const signBottom = STATION_SIGN_Y + STATION_SIGN_H + 2;
    for (const [x, y0, limit] of [[cx0 + 6, canopyBottom, PLINTH_TOP], [cx1 - 8, canopyBottom, PLINTH_TOP],
      [signX + 14, signBottom, STATION_CANOPY_Y], [signX + STATION_SIGN_W - 16, signBottom, STATION_CANOPY_Y]]) {
      const len = Math.min(between(8, STATION_WEAR_RUST_MAX_PX), limit - y0);
      for (let k = 0; k < 3; k++) wear(STATION_WEAR_RUST_COLOR, STATION_WEAR_RUST_ALPHA * (1 - k * 0.3), x, y0 + len * k / 3, k ? 1 : 2, len / 3);
    }

    // Half-buried crate; the sand drift below is drawn over its lower part
    const crateTop = PLINTH_TOP - STATION_WEAR_CRATE_H;
    g.fillStyle(0x000000, 0.55).fillRect(STATION_WEAR_CRATE_X - 1, crateTop - 1, STATION_WEAR_CRATE_W + 2, STATION_WEAR_CRATE_H + 2);
    g.fillStyle(STATION_WEAR_CRATE_COLOR).fillRect(STATION_WEAR_CRATE_X, crateTop, STATION_WEAR_CRATE_W, STATION_WEAR_CRATE_H);
    g.fillStyle(0x000000, 0.3);
    for (let y = crateTop + 6; y < PLINTH_TOP; y += 6) g.fillRect(STATION_WEAR_CRATE_X, y, STATION_WEAR_CRATE_W, 1);
    g.fillRect(STATION_WEAR_CRATE_X + 3, crateTop, 2, STATION_WEAR_CRATE_H).fillRect(STATION_WEAR_CRATE_X + STATION_WEAR_CRATE_W - 5, crateTop, 2, STATION_WEAR_CRATE_H);

    // Sand: a smooth top profile drawn as stacked low-alpha layers (soft edge) over an opaque core, shaded by slope
    // (light from the upper left), with broken wind-ripple lines along the profile, grain, and dust fading up the wall
    const sand = (x0, x1, topY, baseY) => {
      const STEP = 6, LAYER_PX = 3;
      const xs = [];
      for (let x = x0; x < x1; x += STEP) xs.push(x);
      xs.push(x1);
      const poly = (dy, alpha) => {
        const pts = xs.map(x => ({ x, y: topY(x) + dy }));
        pts.push({ x: x1, y: baseY }, { x: x0, y: baseY });
        g.fillStyle(STATION_WEAR_SAND_COLOR, alpha).fillPoints(pts, true);
      };
      for (let k = 0; k < STATION_WEAR_SAND_LAYERS; k++) poly(k * LAYER_PX, STATION_WEAR_SAND_LAYER_ALPHA);
      poly(STATION_WEAR_SAND_LAYERS * LAYER_PX, 1);
      for (let i = 0; i + 1 < xs.length; i++) {
        const ya = topY(xs[i]), yb = topY(xs[i + 1]), slope = (yb - ya) / (xs[i + 1] - xs[i]);
        const lit = slope < 0;                       // rising to the right faces the upper-left light
        g.fillStyle(lit ? STATION_WEAR_SAND_LIGHT : STATION_WEAR_SAND_SHADOW, Math.min(0.3, Math.abs(slope) * 0.9))
          .fillRect(xs[i], Math.min(ya, yb) + 2, xs[i + 1] - xs[i], 12);
        for (let k = 0; k < 5; k++) {                // dust thinning up the wall above the sand
          g.fillStyle(STATION_WEAR_SAND_COLOR, 0.2 * (1 - k / 5)).fillRect(xs[i], Math.min(ya, yb) - (k + 1) * (STATION_WEAR_SAND_FADE_PX / 5), xs[i + 1] - xs[i], STATION_WEAR_SAND_FADE_PX / 5);
        }
      }
      for (let j = 0; j < STATION_WEAR_SAND_RIPPLES; j++) {
        const d = 5 + j * 4;
        g.lineStyle(1, STATION_WEAR_SAND_SHADOW, 0.16);
        for (let i = 0; i + 1 < xs.length; i++) {
          if (rnd() < 0.35) continue;
          g.lineBetween(xs[i], topY(xs[i]) + d, xs[i + 1], topY(xs[i + 1]) + d);
        }
      }
      for (let i = 0; i < STATION_WEAR_SAND_GRAIN * (x1 - x0) / W + 40; i++) {
        const x = between(x0, x1);
        g.fillStyle(rnd() < 0.5 ? STATION_WEAR_SAND_LIGHT : STATION_WEAR_SAND_SHADOW, 0.18)
          .fillRect(x, between(topY(x) + 2, baseY - 1), between(1, 2), 1);
      }
    };
    const wave = (x, seed) => Math.sin(x * 0.021 + seed) * 0.5 + Math.sin(x * 0.047 + seed * 2.3) * 0.3 + 0.8;
    const drift = x => (STATION_WEAR_SAND_MIN_PX + (STATION_WEAR_SAND_MAX_PX - STATION_WEAR_SAND_MIN_PX) * Math.pow(1 - x / W, 1.2)) * wave(x, 1.7) / 1.3;
    sand(0, STATION_DOOR_X, x => PLINTH_TOP - drift(x), PLINTH_TOP + STATION_WEAR_SAND_SPILL_PX);
    sand(doorR, W, x => PLINTH_TOP - drift(x), PLINTH_TOP + STATION_WEAR_SAND_SPILL_PX);

    // Dead scrub (tumbleweed) resting on the drift near the left end of the wall
    const weedY = PLINTH_TOP - drift(STATION_WEAR_WEED_X) - STATION_WEAR_WEED_R * 0.5;
    for (let i = 0; i < 28; i++) {
      const a0 = between(0, Math.PI * 2), a1 = a0 + between(1.4, 3.4);
      const r0 = STATION_WEAR_WEED_R * between(0.6, 1), r1 = STATION_WEAR_WEED_R * between(0.6, 1);
      g.lineStyle(1, STATION_WEAR_WEED_COLORS[i % 2], 0.85).lineBetween(
        STATION_WEAR_WEED_X + Math.cos(a0) * r0, weedY + Math.sin(a0) * r0, STATION_WEAR_WEED_X + Math.cos(a1) * r1, weedY + Math.sin(a1) * r1);
    }

    // Sand heaped over the top steps of the stairwell: the drift's own height function plus a bump that is zero at the
    // jambs, so the two meet flush; everything above it stays the black hole
    sand(STATION_DOOR_X, doorR, x => PLINTH_TOP - drift(x) - STATION_WEAR_STAIR_SAND_PX * Math.sin(Math.PI * (x - STATION_DOOR_X) / STATION_DOOR_W), STATION_BOTTOM);
  }

  update(songMs) {
    const x = stationX(songMs);
    this.g.setVisible(x !== null);
    if (x !== null) this.g.setX(x);
  }
}
