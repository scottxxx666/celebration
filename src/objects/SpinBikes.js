import { crankAngle, legIK, armPose, shade, bikeRowStartX, BIKE_ROW_WIDTH } from '../spinBikes.js';
import {
  GAME_WIDTH, SCENERY_PARALLAX, BIKE_COUNT, BIKE_SPACING, BIKE_WIDTH, BIKE_FLOOR_Y, BIKE_DEPTH, BIKE_PEDAL_BEATS,
  BIKE_THIGH_LEN, BIKE_SHIN_LEN, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN,
  BIKE_FRAME_WIDTH, BIKE_RIM_ALPHA, BIKE_FRAME_COLOR, BIKE_SHOE_COLOR,
  BIKE_COLORS, BIKE_SKINS, BIKE_TOPS, BIKE_SHORTS, BIKE_HAIR,
} from '../config/gameConfig.js';

const PEDAL_RADIUS = 10;
const FLYWHEEL_RADIUS = 14;
const HEAD_RADIUS = 9;
const LEG_WIDTH = 6;
const SHORTS_WIDTH = 11;
const ARM_WIDTH = 4;
const BACK_SHADE = 0.68; // far-side limbs are drawn this much darker for depth

// Bike geometry relative to the rider's centre x and the floor line (y up is negative).
const P = {
  baseBack: { x: -43, y: -3 }, baseFront: { x: 37, y: -3 },
  crank: { x: -4, y: -34 }, flywheel: { x: 25, y: -26 },
  seatPost: { x: -31, y: -66 }, seat: { x: -37, y: -76 }, seatFront: { x: -19, y: -76 },
  hip: { x: -28, y: -80 }, shoulder: { x: -5, y: -112 }, head: { x: 2, y: -123 },
  barBase: { x: 29, y: -46 }, barTop: { x: 33, y: -92 }, barEnd: { x: 43, y: -93 },
};

const at = (cx, p) => ({ x: cx + p.x, y: BIKE_FLOOR_Y + p.y });

// Background row of filled-shape riders in workout clothes on dark stationary spin bikes, drawn each
// frame while visible. It drifts left with the scenery layer (SCENERY_PARALLAX of the world scroll).
// Pose is stateless from the beat grid; only the row's x is accumulated (see bikeRowStartX for the
// first-frame estimate). All riders pedal and hit the beat in unison, like a stage backup line.
export class SpinBikes {
  constructor(scene, conductor) {
    this.conductor = conductor;
    this.gfx = scene.add.graphics().setDepth(BIKE_DEPTH).setVisible(false);
    this.left = null;      // left x of the row while shown
    this.finished = false; // drifted off the left; stays hidden until a non-bikes frame resets it
    this.riders = Array.from({ length: BIKE_COUNT }, (_, i) => {
      const skin = BIKE_SKINS[i % BIKE_SKINS.length];
      const shorts = BIKE_SHORTS[i % BIKE_SHORTS.length];
      return {
        accent: BIKE_COLORS[i % BIKE_COLORS.length],
        skin, skinBack: shade(skin, BACK_SHADE),
        top: BIKE_TOPS[i % BIKE_TOPS.length],
        shorts, shortsBack: shade(shorts, BACK_SHADE),
        hair: BIKE_HAIR[i % BIKE_HAIR.length],
        hairStyle: i % 5, // 0 ponytail, 1 cap, 2 headband, 3 short, 4 bun
        band: i % 2 === 0, // white sweatband on the front wrist
      };
    });
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

  leg(g, hip, foot, skin, shorts) {
    const knee = legIK(hip, foot, BIKE_THIGH_LEN, BIKE_SHIN_LEN);
    this.limb(g, skin, LEG_WIDTH, hip, knee, foot);
    this.limb(g, shorts, SHORTS_WIDTH, hip, { x: hip.x + (knee.x - hip.x) * 0.6, y: hip.y + (knee.y - hip.y) * 0.6 });
    g.fillStyle(BIKE_SHOE_COLOR, 1).fillEllipse(foot.x + 3, foot.y + 3, 15, 8);
  }

  arm(g, shoulder, pose, skin) {
    this.limb(g, skin, ARM_WIDTH, shoulder, pose.elbow, pose.hand);
    g.fillStyle(skin, 1).fillCircle(pose.hand.x, pose.hand.y, 3.2);
  }

  // The bike's strokes in one colour/width, used twice: wide accent rim, then the dark frame on top.
  bikeLines(g, color, width, alpha, cx) {
    const line = (...pts) => {
      g.lineStyle(width, color, alpha).beginPath().moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
      g.strokePath();
    };
    line(at(cx, P.baseBack), at(cx, P.baseFront));
    line(at(cx, P.baseBack), at(cx, P.seatPost), at(cx, P.crank), at(cx, P.barBase));
    line(at(cx, P.baseFront), at(cx, P.flywheel), at(cx, P.barBase));
    line(at(cx, P.seat), at(cx, P.seatFront));
    line(at(cx, P.barBase), at(cx, P.barTop), at(cx, P.barEnd));
  }

  drawRider(g, r, cx, crankBase, beatIndex, sinceBeat, beatMs) {
    const crank = at(cx, P.crank);
    const hip = at(cx, P.hip);
    const shoulder = at(cx, P.shoulder);
    const flywheel = at(cx, P.flywheel);
    const head = at(cx, P.head);
    const front = { x: crank.x + Math.cos(crankBase) * PEDAL_RADIUS, y: crank.y + Math.sin(crankBase) * PEDAL_RADIUS };
    const back = { x: crank.x - Math.cos(crankBase) * PEDAL_RADIUS, y: crank.y - Math.sin(crankBase) * PEDAL_RADIUS };
    const backArm = armPose(shoulder, beatIndex, sinceBeat, beatMs, -1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);
    const frontArm = armPose(shoulder, beatIndex, sinceBeat, beatMs, 1, BIKE_UPPER_ARM_LEN, BIKE_FOREARM_LEN);

    // Far side first
    this.leg(g, hip, back, r.skinBack, r.shortsBack);
    this.arm(g, shoulder, backArm, r.skinBack);

    // Bike: accent rim light, dark frame, flywheel with a turning spoke
    this.bikeLines(g, r.accent, BIKE_FRAME_WIDTH + 3, BIKE_RIM_ALPHA, cx);
    g.fillStyle(r.accent, BIKE_RIM_ALPHA).fillCircle(flywheel.x, flywheel.y, FLYWHEEL_RADIUS + 1.5);
    this.bikeLines(g, BIKE_FRAME_COLOR, BIKE_FRAME_WIDTH, 1, cx);
    g.fillStyle(BIKE_FRAME_COLOR, 1).fillCircle(flywheel.x, flywheel.y, FLYWHEEL_RADIUS);
    g.lineStyle(2, 0x3a3a4a, 1).beginPath().moveTo(flywheel.x, flywheel.y)
      .lineTo(flywheel.x + Math.cos(crankBase) * (FLYWHEEL_RADIUS - 2), flywheel.y + Math.sin(crankBase) * (FLYWHEEL_RADIUS - 2)).strokePath();

    // Torso (tapered quad + rounded shoulders), shorts over the hips, head and hair
    const dx = shoulder.x - hip.x;
    const dy = shoulder.y - hip.y;
    const len = Math.hypot(dx, dy);
    const nx = dy / len;
    const ny = -dx / len;
    g.fillStyle(r.top, 1)
      .fillTriangle(hip.x + nx * 9, hip.y + ny * 9, hip.x - nx * 9, hip.y - ny * 9, shoulder.x + nx * 10, shoulder.y + ny * 10)
      .fillTriangle(hip.x - nx * 9, hip.y - ny * 9, shoulder.x + nx * 10, shoulder.y + ny * 10, shoulder.x - nx * 10, shoulder.y - ny * 10)
      .fillCircle(shoulder.x, shoulder.y, 10);
    g.fillStyle(r.shorts, 1).fillCircle(hip.x, hip.y, 10);
    g.fillStyle(r.skin, 1).fillRect(head.x - 2.5, head.y + 6, 5, 8); // neck
    this.drawHead(g, r, head);

    // Near side last
    this.leg(g, hip, front, r.skin, r.shorts);
    this.arm(g, shoulder, frontArm, r.skin);
    if (r.band) g.fillStyle(0xffffff, 1).fillCircle(frontArm.hand.x + (frontArm.elbow.x - frontArm.hand.x) * 0.3, frontArm.hand.y + (frontArm.elbow.y - frontArm.hand.y) * 0.3, 3.4);
  }

  drawHead(g, r, head) {
    const R = HEAD_RADIUS;
    g.fillStyle(r.skin, 1).fillCircle(head.x, head.y, R);
    g.fillStyle(r.hair, 1);
    if (r.hairStyle === 1) { // cap: dome plus brim toward the front
      g.beginPath().arc(head.x, head.y, R + 0.5, Math.PI, Math.PI * 2).closePath().fillPath();
      g.fillRect(head.x, head.y - R * 0.35 - 1, R + 6, 3);
      return;
    }
    // hair over the back and top of the head
    g.beginPath().arc(head.x, head.y, R + 0.5, Math.PI * 0.6, Math.PI * 1.8).closePath().fillPath();
    if (r.hairStyle === 0) { // ponytail trailing back
      g.fillCircle(head.x - R - 3, head.y + 1, 4).fillCircle(head.x - R - 7, head.y + 6, 3.4);
    } else if (r.hairStyle === 2) { // headband
      g.lineStyle(3, r.accent, 1).beginPath().moveTo(head.x - R, head.y - 2).lineTo(head.x + R, head.y - 4).strokePath();
    } else if (r.hairStyle === 4) { // bun
      g.fillCircle(head.x - 2, head.y - R - 3, 4.5);
    }
  }
}
