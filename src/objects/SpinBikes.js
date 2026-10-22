import { crankAngle, frontLeg, armPose, bikeRowStartX, BIKE_ROW_WIDTH } from '../spinBikes.js';
import {
  GAME_WIDTH, SCENERY_PARALLAX, BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH, BIKE_FLOOR_Y, BIKE_DEPTH, BIKE_PEDAL_BEATS,
  BIKE_HIP_HALF, BIKE_SHOULDER_HALF, BIKE_HIP_RISE, BIKE_SHOULDER_RISE, BIKE_SPLAY,
  BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN,
  BIKE_FRAME_WIDTH, BIKE_RIM_ALPHA, BIKE_FRAME_COLOR, BIKE_SHOE_COLOR,
  BIKE_COLORS, BIKE_SKINS, BIKE_TOPS, BIKE_SHORTS, BIKE_HAIR,
} from '../config/gameConfig.js';

const PEDAL_RADIUS = 6;
const CRANK_FORWARD = 6;  // crank centre this far in front of the hips (toward the camera), sagittal plane
const CRANK_RISE = 28;    // crank centre height above the floor line
const HEAD_RADIUS = 8;
const HEAD_RISE = 103;    // head centre height above the floor line
const LEG_WIDTH = 6;
const SHORTS_WIDTH = 10;
const ARM_WIDTH = 4;
const BAR_RISE = 70;      // handlebar height above the floor line (belly)
const BAR_HALF = 15;      // half the handlebar's width
const POST_TOP_RISE = 66;
const STAB_HALF = 26;     // half the floor stabiliser bar's width

// Background row of front-facing filled-shape riders in workout clothes on dark stationary spin bikes,
// seen from the audience, drawn each frame while visible. It drifts left with the scenery layer
// (SCENERY_PARALLAX of the world scroll). Pose is stateless from the beat grid; only the row's x is
// accumulated (see bikeRowStartX for the first-frame estimate). All riders pedal and hit the beat in
// unison, like a stage backup line.
export class SpinBikes {
  constructor(scene, conductor) {
    this.conductor = conductor;
    this.gfx = scene.add.graphics().setDepth(BIKE_DEPTH).setVisible(false);
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
      this.gfx.clear().setVisible(false);
      return;
    }

    const { conductor } = this;
    const beatMs = conductor.beatMs;
    const crank = crankAngle(conductor.phaseMs(BIKE_PEDAL_BEATS), beatMs * BIKE_PEDAL_BEATS);
    const beatIndex = conductor.gridIndex(1);
    const sinceBeat = conductor.phaseMs(1);

    const g = this.gfx.clear().setVisible(true);
    for (let i = 0; i < BIKE_COUNT; i++) {
      const cx = this.left + BIKE_WIDTH / 2 + i * BIKE_SPACING;
      if (cx + BIKE_WIDTH < 0 || cx - BIKE_WIDTH > GAME_WIDTH) continue;
      this.drawRider(g, this.riders[i], cx, crank, beatIndex, sinceBeat, beatMs);
    }
  }

  // Thick polyline with a filled round cap at every point.
  limb(g, color, width, ...pts) {
    g.lineStyle(width, color, 1).beginPath().moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
    g.strokePath().fillStyle(color, 1);
    for (const p of pts) g.fillCircle(p.x, p.y, width / 2);
  }

  leg(g, hip, crankAng, side, r) {
    const { knee, foot } = frontLeg(
      hip, { x: CRANK_FORWARD, y: BIKE_FLOOR_Y - CRANK_RISE }, PEDAL_RADIUS, crankAng, side,
      BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_SPLAY,
    );
    this.limb(g, r.skin, LEG_WIDTH, hip, knee, foot);
    this.limb(g, r.shorts, SHORTS_WIDTH, hip, { x: hip.x + (knee.x - hip.x) * 0.6, y: hip.y + (knee.y - hip.y) * 0.6 });
    g.fillStyle(BIKE_SHOE_COLOR, 1).fillEllipse(foot.x, foot.y + 3, 11, 7);
  }

  arm(g, shoulder, pose, skin) {
    this.limb(g, skin, ARM_WIDTH, shoulder, pose.elbow, pose.hand);
    g.fillStyle(skin, 1).fillCircle(pose.hand.x, pose.hand.y, 3);
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
  }

  drawHandlebar(g, r, cx) {
    const y = BIKE_FLOOR_Y - BAR_RISE;
    const bar = (color, width, alpha) => g.lineStyle(width, color, alpha).beginPath()
      .moveTo(cx - BAR_HALF, y - 6).lineTo(cx - BAR_HALF, y).lineTo(cx + BAR_HALF, y).lineTo(cx + BAR_HALF, y - 6)
      .moveTo(cx, y).lineTo(cx, y + 6).strokePath();
    bar(r.accent, BIKE_FRAME_WIDTH + 3, BIKE_RIM_ALPHA);
    bar(BIKE_FRAME_COLOR, BIKE_FRAME_WIDTH, 1);
  }

  drawRider(g, r, cx, crankBase, beatIndex, sinceBeat, beatMs) {
    const hipY = BIKE_FLOOR_Y - BIKE_HIP_RISE;
    const shoulderY = BIKE_FLOOR_Y - BIKE_SHOULDER_RISE;
    const hipL = { x: cx - BIKE_HIP_HALF, y: hipY };
    const hipR = { x: cx + BIKE_HIP_HALF, y: hipY };
    const shL = { x: cx - BIKE_SHOULDER_HALF, y: shoulderY };
    const shR = { x: cx + BIKE_SHOULDER_HALF, y: shoulderY };
    const head = { x: cx, y: BIKE_FLOOR_Y - HEAD_RISE };

    this.leg(g, hipL, crankBase, -1, r);
    this.leg(g, hipR, crankBase + Math.PI, 1, r);
    this.drawBike(g, r, cx);

    // Tank top (trapezoid, shoulders wider than hips), shorts across both hips, neck
    const tw = BIKE_HIP_HALF + 1;
    g.fillStyle(r.top, 1)
      .fillTriangle(shL.x, shL.y, shR.x, shR.y, cx + tw, hipY)
      .fillTriangle(shL.x, shL.y, cx + tw, hipY, cx - tw, hipY)
      .fillCircle(shL.x, shL.y + 2, 3).fillCircle(shR.x, shR.y + 2, 3);
    g.fillStyle(r.shorts, 1).fillRoundedRect(cx - BIKE_HIP_HALF - 5, hipY - 3, BIKE_HIP_HALF * 2 + 10, 12, 4);
    g.fillStyle(r.skin, 1).fillRect(cx - 2.5, head.y + 6, 5, shoulderY - head.y - 4);
    this.drawHandlebar(g, r, cx);
    this.drawHead(g, r, head);

    const armL = armPose(shL, beatIndex, sinceBeat, beatMs, -1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
    const armR = armPose(shR, beatIndex, sinceBeat, beatMs, 1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
    this.arm(g, shL, armL, r.skin);
    this.arm(g, shR, armR, r.skin);
    if (r.band) {
      g.fillStyle(0xffffff, 1).fillCircle(
        armR.hand.x + (armR.elbow.x - armR.hand.x) * 0.3, armR.hand.y + (armR.elbow.y - armR.hand.y) * 0.3, 3.2);
    }
  }

  drawHead(g, r, head) {
    const R = HEAD_RADIUS;
    g.fillStyle(r.skin, 1).fillCircle(head.x, head.y, R);
    g.fillStyle(0x222222, 1).fillCircle(head.x - 3, head.y + 1, 1).fillCircle(head.x + 3, head.y + 1, 1);
    g.fillStyle(r.hair, 1);
    if (r.hairStyle === 1) { // cap: dome plus a brim band across the forehead
      g.beginPath().arc(head.x, head.y, R + 0.5, Math.PI, Math.PI * 2).closePath().fillPath();
      g.fillRoundedRect(head.x - R - 2, head.y - 4, R * 2 + 4, 3.5, 1.5);
      return;
    }
    // hair dome over the top plus a strip down each side of the face
    g.beginPath().arc(head.x, head.y, R + 0.5, Math.PI, Math.PI * 2).closePath().fillPath();
    g.fillRect(head.x - R - 0.5, head.y - 2, 3, 8).fillRect(head.x + R - 2.5, head.y - 2, 3, 8);
    if (r.hairStyle === 0) { // ponytail peeking out at one side
      g.fillCircle(head.x + R + 3, head.y + 2, 3.5).fillCircle(head.x + R + 4, head.y + 7, 3);
    } else if (r.hairStyle === 2) { // headband across the forehead
      g.lineStyle(3, r.accent, 1).beginPath().moveTo(head.x - R, head.y - 3).lineTo(head.x + R, head.y - 3).strokePath();
    } else if (r.hairStyle === 4) { // bun on top
      g.fillCircle(head.x, head.y - R - 3, 4.5);
    }
  }
}
