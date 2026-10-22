import {
  crankAngle, frontLeg, armPose, armLean, gripArm, gripDip, headNod, laggedBeat, shade, bikeRowStartX, BIKE_ROW_WIDTH,
} from '../spinBikes.js';
import {
  GAME_WIDTH, SCENERY_PARALLAX, BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH, BIKE_FLOOR_Y, BIKE_DEPTH, BIKE_PEDAL_BEATS,
  BIKE_HIP_HALF, BIKE_SHOULDER_HALF, BIKE_PEDAL_RADIUS, BIKE_BAR_RISE, BIKE_BAR_HALF, BIKE_GRIP_LEN, BIKE_GRIP_FORESHORTEN, BIKE_HIP_RISE, BIKE_SHOULDER_RISE, BIKE_SPLAY,
  BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN,
  BIKE_GRIP_HUNCH_PX, BIKE_NOD_HAIR_REST, BIKE_NOD_HAIR_FULL, BIKE_SHOULDER_BOB_PX, BIKE_HAIR_LAG_MS, BIKE_HAIR_SWING_PX,
  BIKE_FRAME_WIDTH, BIKE_RIM_ALPHA, BIKE_FRAME_COLOR, BIKE_SHOE_COLOR, BIKE_OUTLINE_COLOR, BIKE_RENDER_SCALE,
  BIKE_COLORS, BIKE_SKINS, BIKE_TOPS, BIKE_SHORTS, BIKE_HAIR,
} from '../config/gameConfig.js';

const CRANK_FORWARD = 6;  // crank centre this far in front of the hips (toward the camera), sagittal plane
const CRANK_RISE = 28;    // crank centre height above the floor line
const HEAD_RX = 7.2;      // head half-width; the half-height is HEAD_RY
const HEAD_RY = 8;
const JAW_NARROW = 0.18;  // the head's width shrinks by this much at the chin
const HEAD_RISE = 103;    // head centre height above the floor line
const POST_TOP_RISE = 66;
const STAB_HALF = 26;     // half the floor stabiliser bar's width
const OUTLINE = 1;        // px, outline thickness outside each body part
const SHADE_K = 0.78;     // cel-shadow tone (light from the upper left; the shadow side is screen-right)
const STRIP_TOP = BIKE_FLOOR_Y - 130; // top of the offscreen strip (above the tallest hair / raised hand)
const STRIP_H = 142;                  // strip height, floor line plus the shoes
const STRIP_MARGIN = 80;              // strip extends this far past each side of the screen (zoomed-out cameras)
const S = BIKE_RENDER_SCALE;

const pt = (x, y) => ({ x, y });
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const paint = (color, ol) => (ol ? BIKE_OUTLINE_COLOR : color);

// Closed polygon; with `ol` it is the outline underlay (the shape grown by `ol` on every side).
function poly(g, pts, color, ol) {
  if (ol) g.lineStyle(ol * 2, BIKE_OUTLINE_COLOR, 1).strokePoints(pts, true, true);
  g.fillStyle(paint(color, ol), 1).fillPoints(pts, true);
}

function ellipse(g, x, y, w, h, color, ol) {
  g.fillStyle(paint(color, ol), 1).fillEllipse(x, y, w + ol * 2, h + ol * 2);
}

// Unit normal of a segment pointing to the shadow side: screen-right, or down for a horizontal segment.
function shadowNormal(a, b) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let nx = -(b.y - a.y) / len;
  let ny = (b.x - a.x) / len;
  if (nx < -1e-6 || (Math.abs(nx) <= 1e-6 && ny < 0)) { nx = -nx; ny = -ny; }
  return pt(nx, ny);
}

// Tapered limb: round joints of `radii[k]` at `pts[k]` joined by quads (wider at the proximal end). With `ol` it
// is the outline underlay; otherwise `shadeColor` adds the cel-shadow band on each segment's shadow side, and
// `hand` draws the last joint as a slightly longer oval.
function chain(g, color, pts, radii, ol, shadeColor, hand = false) {
  g.fillStyle(paint(color, ol), 1);
  for (let k = 0; k < pts.length; k++) {
    if (hand && k === pts.length - 1) g.fillEllipse(pts[k].x, pts[k].y, (radii[k] + ol) * 2, (radii[k] * 1.2 + ol) * 2);
    else g.fillCircle(pts[k].x, pts[k].y, radii[k] + ol);
  }
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const n = shadowNormal(a, b);
    const ra = radii[k] + ol;
    const rb = radii[k + 1] + ol;
    g.fillPoints([
      pt(a.x + n.x * ra, a.y + n.y * ra), pt(b.x + n.x * rb, b.y + n.y * rb),
      pt(b.x - n.x * rb, b.y - n.y * rb), pt(a.x - n.x * ra, a.y - n.y * ra)], true);
  }
  if (ol || shadeColor === undefined) return;
  g.fillStyle(shadeColor, 1);
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const n = shadowNormal(a, b);
    const ra = radii[k];
    const rb = radii[k + 1];
    g.fillPoints([
      pt(a.x + n.x * ra, a.y + n.y * ra), pt(b.x + n.x * rb, b.y + n.y * rb),
      pt(b.x + n.x * rb * 0.4, b.y + n.y * rb * 0.4), pt(a.x + n.x * ra * 0.4, a.y + n.y * ra * 0.4)], true);
  }
}

// Head outline: an ellipse whose width narrows toward the chin.
function headPoints(cx, cy, rx, ry) {
  const pts = [];
  for (let k = 0; k < 28; k++) {
    const t = (k / 28) * Math.PI * 2;
    const s = Math.sin(t);
    pts.push(pt(cx + Math.cos(t) * rx * (1 - JAW_NARROW * Math.max(s, 0) ** 2), cy + s * ry));
  }
  return pts;
}

// Crescent hugging the shadow side of `pts` (a head outline) between ellipse angles t0..t1, `depth` of the way in at its widest.
function crescent(pts, cx, cy, t0, t1, depth) {
  const n = pts.length;
  const lo = Math.round(((t0 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * n);
  const hi = lo + Math.round((t1 - t0) / (Math.PI * 2) * n);
  const outer = [];
  const inner = [];
  for (let k = lo; k <= hi; k++) {
    const p = pts[k % n];
    const w = Math.sin(Math.PI * (k - lo) / (hi - lo));
    outer.push(p);
    inner.push(pt(p.x + (cx - p.x) * depth * w, p.y + (cy - p.y) * depth * w));
  }
  return outer.concat(inner.reverse());
}

// Background row of front-facing flat-shaded riders in workout clothes on dark stationary spin bikes,
// seen from the audience, drawn each frame while visible. It drifts left with the scenery layer
// (SCENERY_PARALLAX of the world scroll). Pose is stateless from the beat grid; only the row's x is
// accumulated (see bikeRowStartX for the first-frame estimate). All riders pedal and hit the beat in
// unison, like a stage backup line. The riders are drawn with an invisible Graphics at BIKE_RENDER_SCALE x
// into a RenderTexture shown scaled back down, which smooths the edges.
export class SpinBikes {
  constructor(scene, conductor) {
    this.conductor = conductor;
    this.gfx = scene.make.graphics({ add: false }).setScale(S).setPosition(S * STRIP_MARGIN, -S * STRIP_TOP);
    this.rt = scene.add.renderTexture(-STRIP_MARGIN, STRIP_TOP, S * (GAME_WIDTH + 2 * STRIP_MARGIN), S * STRIP_H)
      .setOrigin(0).setScale(1 / S).setDepth(BIKE_DEPTH).setVisible(false);
    scene.events.once('shutdown', () => this.gfx.destroy());
    this.left = null;      // left x of the row while shown
    this.finished = false; // drifted off the left; stays hidden until a non-bikes frame resets it
    this.riders = Array.from({ length: BIKE_COUNT }, (_, i) => ({
      accent: BIKE_COLORS[i % BIKE_COLORS.length],
      skin: BIKE_SKINS[i % BIKE_SKINS.length],
      top: BIKE_TOPS[i % BIKE_TOPS.length],
      shorts: BIKE_SHORTS[i % BIKE_SHORTS.length],
      hair: BIKE_HAIR[i % BIKE_HAIR.length],
      hairStyle: i % 5, // 0 ponytail, 1 cap, 2 headband, 3 short, 4 bun
      band: i % 2 === 0, // white sweatband on the screen-right wrist
    }));
  }

  update(section, songMs, worldDx) {
    if (this.left === null) {
      if (!section.bikes) this.finished = false;
      else if (!this.finished) this.left = bikeRowStartX(section, songMs);
    } else {
      this.left -= worldDx * SCENERY_PARALLAX;
    }
    if (this.left !== null && this.left + BIKE_ROW_WIDTH < 0) {
      this.left = null;
      this.finished = true;
    }
    if (this.left === null || this.left > GAME_WIDTH) {
      this.rt.setVisible(false);
      return;
    }

    const { conductor } = this;
    const beatMs = conductor.beatMs;
    const crank = crankAngle(conductor.phaseMs(BIKE_PEDAL_BEATS), beatMs * BIKE_PEDAL_BEATS);
    const beatIndex = conductor.gridIndex(1);
    const sinceBeat = conductor.phaseMs(1);
    this.grip = section.bikes === 'grip';
    this.dip = this.grip ? gripDip(sinceBeat, beatMs) : 0;
    // hair replays the head / arm motion late: relative to the head it trails the nod, and swings with the lagged lean
    const lag = laggedBeat(beatIndex, sinceBeat, beatMs, BIKE_HAIR_LAG_MS);
    this.hair = this.grip
      ? pt(0, (gripDip(lag.msSinceBeat, beatMs) - this.dip) * BIKE_HAIR_SWING_PX)
      : pt(armLean(lag.beatIndex, lag.msSinceBeat, beatMs) * BIKE_HAIR_SWING_PX, 0);

    const g = this.gfx.clear();
    for (let i = 0; i < BIKE_COUNT; i++) {
      const cx = this.left + BIKE_WIDTH / 2 + i * BIKE_SPACING;
      if (cx + BIKE_WIDTH < 0 || cx - BIKE_WIDTH > GAME_WIDTH) continue;
      this.drawRider(g, this.riders[i], cx, crank, beatIndex, sinceBeat, beatMs);
    }
    this.rt.clear().draw(g).setVisible(true);
  }

  leg(g, hip, crankAng, side, r) {
    const { knee, foot } = frontLeg(
      hip, { x: CRANK_FORWARD, y: BIKE_FLOOR_Y - CRANK_RISE }, BIKE_PEDAL_RADIUS, crankAng, side,
      BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY,
    );
    const skinShade = shade(r.skin, SHADE_K);
    const shortsEnd = lerp(hip, knee, 0.62);
    const sockStart = lerp(knee, foot, 0.7);
    for (const ol of [OUTLINE, 0]) {
      chain(g, r.skin, [hip, knee, foot], [6.6, 4.8, 3.2], ol, skinShade);
      chain(g, r.shorts, [hip, shortsEnd], [7.8, 7], ol, shade(r.shorts, SHADE_K));
      chain(g, 0xf4f4f4, [sockStart, foot], [3.8, 3.3], ol, shade(0xf4f4f4, 0.82));
      ellipse(g, foot.x, foot.y + 3.6, 12, 6.4, BIKE_SHOE_COLOR, ol); // sneaker
      if (!ol) {
        g.fillStyle(shade(BIKE_SHOE_COLOR, 0.82), 1).fillEllipse(foot.x + 2.5, foot.y + 4, 6, 4.2);
        g.fillStyle(BIKE_SHOE_COLOR, 1).fillEllipse(foot.x - 1, foot.y + 3.1, 8, 4.4);
        g.fillStyle(r.accent, 1).fillRect(foot.x - 5.6, foot.y + 5.3, 11.2, 1.1); // sole stripe
      }
    }
  }

  arm(g, shoulder, pose, r, fist) {
    const skinShade = shade(r.skin, SHADE_K);
    for (const ol of [OUTLINE, 0]) {
      chain(g, r.skin, [shoulder, pose.elbow, pose.hand], [3.8, 3.1, 2.8], ol, skinShade, true);
      if (fist) { // fist wrapped over the grip: wider than the grip, with the grip end showing above and below
        const { x, y } = pose.hand;
        g.fillStyle(paint(r.skin, ol), 1).fillRoundedRect(x - 4 - ol, y - 3.2 - ol, 8 + ol * 2, 6.4 + ol * 2, 2.6);
        if (!ol) {
          g.fillStyle(skinShade, 1).fillRoundedRect(x + 0.6, y - 3.2, 3.4, 6.4, { tl: 0, bl: 0, tr: 2.6, br: 2.6 });
          g.lineStyle(0.8, BIKE_OUTLINE_COLOR, 0.7).beginPath().moveTo(x - 3.6, y - 1).lineTo(x + 3.6, y - 1)
            .moveTo(x - 3.6, y + 1.1).lineTo(x + 3.6, y + 1.1).strokePath(); // finger gaps
        }
      }
    }
    if (r.band) { // white sweatband just above the wrist
      const a = lerp(pose.hand, pose.elbow, 0.2);
      const b = lerp(pose.hand, pose.elbow, 0.42);
      for (const ol of [OUTLINE, 0]) chain(g, 0xffffff, [a, b], [3.1, 3.2], ol, shade(0xffffff, 0.8));
    }
  }

  // Front-on bike body: floor stabiliser with feet, edge-on flywheel with accent rim light, post.
  drawBike(g, r, cx) {
    const f = BIKE_FLOOR_Y;
    const line = (color, width, alpha, x1, y1, x2, y2) => g.lineStyle(width, color, alpha)
      .beginPath().moveTo(x1, y1).lineTo(x2, y2).strokePath();
    const rim = BIKE_FRAME_WIDTH + 3;
    line(r.accent, rim, BIKE_RIM_ALPHA, cx - STAB_HALF, f - 3, cx + STAB_HALF, f - 3);
    line(r.accent, rim, BIKE_RIM_ALPHA, cx, f - 3, cx, f - POST_TOP_RISE);
    g.fillStyle(r.accent, BIKE_RIM_ALPHA).fillRoundedRect(cx - 7, f - 42, 14, 36, 7);
    line(BIKE_FRAME_COLOR, BIKE_FRAME_WIDTH, 1, cx - STAB_HALF, f - 3, cx + STAB_HALF, f - 3);
    line(BIKE_FRAME_COLOR, BIKE_FRAME_WIDTH, 1, cx, f - 3, cx, f - POST_TOP_RISE);
    g.fillStyle(BIKE_FRAME_COLOR, 1)
      .fillRoundedRect(cx - 5, f - 40, 10, 32, 5)
      .fillRect(cx - STAB_HALF - 2, f - 6, 5, 6)
      .fillRect(cx + STAB_HALF - 3, f - 6, 5, 6);
    // highlights on the lit (upper-left) edges
    const hi = shade(BIKE_FRAME_COLOR, 3.4);
    line(hi, 1, 0.9, cx - STAB_HALF + 1, f - 4.8, cx + STAB_HALF - 1, f - 4.8);
    line(hi, 1, 0.9, cx - 1.6, f - POST_TOP_RISE + 1, cx - 1.6, f - 5);
    line(hi, 1, 0.9, cx - 3.4, f - 36, cx - 3.4, f - 12);
  }

  drawHandlebar(g, r, cx) {
    const y = BIKE_FLOOR_Y - BIKE_BAR_RISE;
    const bar = (color, width, alpha, dy = 0) => g.lineStyle(width, color, alpha).beginPath()
      .moveTo(cx - BIKE_BAR_HALF, y - BIKE_GRIP_LEN + dy).lineTo(cx - BIKE_BAR_HALF, y + dy).lineTo(cx + BIKE_BAR_HALF, y + dy)
      .lineTo(cx + BIKE_BAR_HALF, y - BIKE_GRIP_LEN + dy).moveTo(cx, y + dy).lineTo(cx, y + 6 + dy).strokePath();
    bar(r.accent, BIKE_FRAME_WIDTH + 3, BIKE_RIM_ALPHA);
    bar(BIKE_FRAME_COLOR, BIKE_FRAME_WIDTH, 1);
    bar(shade(BIKE_FRAME_COLOR, 3.4), 1, 0.9, -1.4);
    // small console on the stem, just above the bar: dark bezel with an accent-lit screen
    g.fillStyle(r.accent, BIKE_RIM_ALPHA).fillRoundedRect(cx - 5, y - 7.5, 10, 6, 2);
    g.fillStyle(BIKE_FRAME_COLOR, 1).fillRoundedRect(cx - 4, y - 6.5, 8, 4, 1.2);
    g.fillStyle(r.accent, 0.95).fillRoundedRect(cx - 3, y - 5.6, 6, 2.2, 0.8);
  }

  // Tank top with strap / neckline / armhole cuts, a skin chest inside it, and a shade band on its right side.
  drawTorso(g, r, cx, sy, hipY, dip) {
    const w = BIKE_HIP_HALF + 1.5;
    const neck = [];
    for (let k = 0; k <= 6; k++) { // quadratic neckline, bottom at sy + 6.5
      const u = k / 6;
      neck.push(pt(cx - 7 + 14 * u, (1 - u) * (1 - u) * (sy - 1) + 2 * u * (1 - u) * (sy + 14) + u * u * (sy - 1)));
    }
    const right = [pt(cx + 7.6, sy - 1), pt(cx + 12, sy - 1), pt(cx + 11.4, sy + 5), pt(cx + 9.6, sy + 11), pt(cx + w, hipY + 2)];
    const left = [pt(cx - w, hipY + 2), pt(cx - 9.6, sy + 11), pt(cx - 11.4, sy + 5), pt(cx - 12, sy - 1), pt(cx - 7.6, sy - 1)];
    const outline = [...left, ...neck, ...right];
    g.fillStyle(r.skin, 1).fillRect(cx - 8, sy - 1, 16, 9);
    poly(g, outline, r.top, OUTLINE);
    poly(g, outline, r.top, 0);
    poly(g, [pt(cx + 5.4, sy + 6.5), pt(cx + 9.6, sy + 11), pt(cx + w, hipY + 2), pt(cx + 5, hipY + 2)], shade(r.top, SHADE_K), 0);
    g.lineStyle(1, shade(r.top, 1.25), 0.7).beginPath().moveTo(cx - 9, sy + 12).lineTo(cx - w + 0.8, hipY - 1).strokePath();
    g.lineStyle(1.2, BIKE_OUTLINE_COLOR, 1).strokePoints(outline, true, true);
    // skin shadow under the neckline
    g.fillStyle(shade(r.skin, SHADE_K), 1).fillEllipse(cx + 0.5, sy + 1.2, 10, 3);
    // shorts: waist block across both hips (the thigh parts are drawn with the legs)
    const sh = [pt(cx - 12.5, hipY - 3), pt(cx + 12.5, hipY - 3), pt(cx + 13.5, hipY + 4), pt(cx + 10, hipY + 9), pt(cx - 10, hipY + 9), pt(cx - 13.5, hipY + 4)];
    poly(g, sh, r.shorts, OUTLINE);
    poly(g, sh, r.shorts, 0);
    poly(g, [pt(cx + 4.5, hipY - 3), pt(cx + 12.5, hipY - 3), pt(cx + 13.5, hipY + 4), pt(cx + 10, hipY + 9), pt(cx + 4.5, hipY + 9)], shade(r.shorts, SHADE_K), 0);
    g.fillStyle(r.accent, 0.9).fillRect(cx - 12.5, hipY - 3, 25, 2.2); // waistband
    g.lineStyle(1.2, BIKE_OUTLINE_COLOR, 1).strokePoints(sh, true, true);
    g.lineStyle(1, BIKE_OUTLINE_COLOR, 0.8).beginPath().moveTo(cx, hipY + 3).lineTo(cx, hipY + 9).strokePath();
  }

  drawRider(g, r, cx, crankBase, beatIndex, sinceBeat, beatMs) {
    const hipY = BIKE_FLOOR_Y - BIKE_HIP_RISE;
    const grip = this.grip;
    const shoulderY = BIKE_FLOOR_Y - BIKE_SHOULDER_RISE + (grip ? BIKE_GRIP_HUNCH_PX - BIKE_SHOULDER_BOB_PX * this.dip : 0);
    const hipL = { x: cx - BIKE_HIP_HALF, y: hipY };
    const hipR = { x: cx + BIKE_HIP_HALF, y: hipY };
    const shL = { x: cx - BIKE_SHOULDER_HALF, y: shoulderY };
    const shR = { x: cx + BIKE_SHOULDER_HALF, y: shoulderY };
    const nod = headNod(this.dip); // dip is 0 in wave mode, so the head is upright
    const head = { x: cx, y: BIKE_FLOOR_Y - HEAD_RISE + (grip ? BIKE_GRIP_HUNCH_PX : 0) + nod.dropPx };

    this.leg(g, hipL, crankBase, -1, r);
    this.leg(g, hipR, crankBase + Math.PI, 1, r);
    this.drawBike(g, r, cx);

    const neckTop = pt(cx, head.y + 5);
    const neckBase = pt(cx, shoulderY + 2);
    for (const ol of [OUTLINE, 0]) chain(g, r.skin, [neckTop, neckBase], [2.8, 3.2], ol, shade(r.skin, SHADE_K));
    this.drawTorso(g, r, cx, shoulderY, hipY, this.dip);
    this.drawHandlebar(g, r, cx);
    this.drawHead(g, r, head, nod);

    const barY = BIKE_FLOOR_Y - BIKE_BAR_RISE - BIKE_GRIP_LEN / 2; // grip: middle of the upturned bar end
    const armL = grip ? gripArm(shL, { x: cx - BIKE_BAR_HALF, y: barY }, -1, BIKE_UPPER_ARM_LEN * BIKE_GRIP_FORESHORTEN, BIKE_FOREARM_LEN * BIKE_GRIP_FORESHORTEN)
      : armPose(shL, beatIndex, sinceBeat, beatMs, -1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
    const armR = grip ? gripArm(shR, { x: cx + BIKE_BAR_HALF, y: barY }, 1, BIKE_UPPER_ARM_LEN * BIKE_GRIP_FORESHORTEN, BIKE_FOREARM_LEN * BIKE_GRIP_FORESHORTEN)
      : armPose(shR, beatIndex, sinceBeat, beatMs, 1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
    this.arm(g, shL, armL, { ...r, band: false }, grip);
    this.arm(g, shR, armR, r, grip);
  }

  // Front-on head that tips forward as nod.hairEdge grows: the skin shape squashes, the hair covers it from
  // the top down to hairEdge (the crown), and the eyes and hair details follow the edge. Drawn as an outline
  // underlay of every part first, then the fills, so the outline only shows around the union.
  drawHead(g, r, head, nod) {
    const rx = HEAD_RX;
    const ry = HEAD_RY * nod.squash;
    const edgeY = head.y - ry + 2 * ry * nod.hairEdge;
    const pitch = (nod.hairEdge - BIKE_NOD_HAIR_REST) / (BIKE_NOD_HAIR_FULL - BIKE_NOD_HAIR_REST);
    const chord = y => Math.sqrt(Math.max(1 - ((y - head.y) / ry) ** 2, 0)) * rx; // half width of the head at y
    const skull = headPoints(head.x, head.y, rx, ry);
    const hrx = rx + 1.3; // the hair is fuller than the skull
    const hry = ry + 1.2;
    const a = Math.asin(Math.min(Math.max((edgeY - head.y) / hry, -1), 1));
    const dome = [];
    for (let k = 0; k <= 18; k++) {
      const t = Math.PI - a + (Math.PI + 2 * a) * (k / 18);
      dome.push(pt(head.x + Math.cos(t) * hrx, head.y + Math.sin(t) * hry));
    }
    const hair = this.hair;
    const style = r.hairStyle;
    const sbBottom = Math.max(head.y - 1, Math.min(edgeY + 6 * (1 - pitch), head.y + 1.5)); // sideburn bottom
    const sideburns = style !== 1;
    const brimH = 3.6 * (1 - 0.6 * pitch);
    const brimHalf = chord(edgeY - brimH) + 2.4;
    const bandY = edgeY - 3;
    const bunY = head.y - HEAD_RY - 3 + (head.y - 2 - (head.y - HEAD_RY - 3)) * pitch;

    for (const ol of [OUTLINE, 0]) {
      const col = c => paint(c, ol);
      for (const sx of [-1, 1]) { // ears
        ellipse(g, head.x + sx * (rx - 0.1), head.y + 2.8, 3.2, 4.6, r.skin, ol);
      }
      poly(g, skull, r.skin, ol);
      if (!ol) {
        poly(g, crescent(skull, head.x, head.y, -0.85, 1.25, 0.3), shade(r.skin, SHADE_K), 0);
        if (nod.eyesVisible) {
          const eyeY = head.y + 1 + 3 * pitch;
          g.fillStyle(0x222222, 1).fillCircle(head.x - 2.9, eyeY, 1.05).fillCircle(head.x + 2.9, eyeY, 1.05);
          const my = head.y + 4.6 + 3 * pitch;
          g.lineStyle(0.9, shade(r.skin, 0.55), 1).beginPath().moveTo(head.x - 1.6, my).lineTo(head.x, my + 0.7).lineTo(head.x + 1.6, my).strokePath();
        }
      }
      poly(g, dome, r.hair, ol);
      if (sideburns) {
        for (const sx of [-1, 1]) {
          const o = head.x + sx * hrx;
          const i = head.x + sx * (rx - 1.1);
          poly(g, [pt(o, head.y - 2), pt(i, head.y - 2), pt(i, sbBottom), pt(o - sx * 0.6, sbBottom)], r.hair, ol);
        }
      }
      if (style === 0) { // ponytail swinging out at one side
        chain(g, r.hair, [pt(head.x + rx + 0.4, head.y - 4), pt(head.x + rx + 3.6 + hair.x, head.y + 3 + hair.y * 0.5),
          pt(head.x + rx + 4.2 + hair.x * 1.9, head.y + 10 + hair.y)], [2.6, 3.3, 1.5], ol, shade(r.hair, SHADE_K));
        if (!ol) g.fillStyle(r.accent, 1).fillCircle(head.x + rx + 0.9, head.y - 3.6, 1.5);
      } else if (style === 1) { // cap: brim band at the hair edge, foreshortened as we look down on it
        poly(g, [pt(head.x - brimHalf + 1, edgeY - brimH - 0.5), pt(head.x + brimHalf - 1, edgeY - brimH - 0.5),
          pt(head.x + brimHalf + 1, edgeY - 0.3), pt(head.x - brimHalf - 1, edgeY - 0.3)], shade(r.hair, 1.6), ol);
      } else if (style === 2) { // headband across the forehead, riding the hair edge
        const half = chord(bandY) + 0.4;
        g.lineStyle(ol ? 3 + 2 * ol : 3, col(r.accent), 1).beginPath().moveTo(head.x - half, bandY).lineTo(head.x + half, bandY).strokePath();
      } else if (style === 4) { // bun on the crown; seen from above it moves toward the head's centre
        g.fillStyle(col(r.hair), 1).fillCircle(head.x + hair.x * 0.6, bunY + hair.y, 4.6 + ol);
        if (!ol) g.fillStyle(shade(r.hair, SHADE_K), 1).fillCircle(head.x + hair.x * 0.6 + 1.4, bunY + hair.y + 1.2, 2.6);
      }
      if (!ol && style !== 1 && edgeY > head.y - ry + 3) { // glossy highlight arc on the lit side of the hair
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const t = Math.PI * (1.12 + 0.3 * (k / 6));
          pts.push(pt(head.x + Math.cos(t) * (hrx - 1.2), head.y + Math.sin(t) * (hry - 1.2)));
        }
        g.lineStyle(1, shade(r.hair, 2.2), 0.55).strokePoints(pts, false, false);
      }
    }
  }
}
