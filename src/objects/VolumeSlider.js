import Phaser from 'phaser';
import {
  HUD_CORNER_X,
  HUD_MARGIN,
  HUD_HIT,
  HUD_DEPTH,
  HUD_ALPHA_DIM,
  HUD_ALPHA_BRIGHT,
  KEYCAP_DARK as COLOR_DARK,
  KEYCAP_MID as COLOR_MID,
  KEYCAP_LIGHT as COLOR_LIGHT,
  hudPart,
} from '../config/ui.js';
import { getUserVolume, setUserVolume, saveUserVolume } from '../userVolume.js';
import { bindPointer } from '../input.js';

const SLIDER_Y = HUD_MARGIN; // same top row as the fullscreen button
const TRACK_W = 80;
const TRACK_H = 6;
const TRACK_RADIUS = 3;    // rounded track corners; fill skipped below the corner diameter
const KNOB_RADIUS = 8;
const ICON_W = 14;         // speaker body + cone footprint
const ICON_H = 18;         // matches the fullscreen button's ICON_SIZE
const ICON_BODY_W = 5;     // speaker body rectangle width
const ICON_BODY_H = 8;     // speaker body rectangle height
const ARC_RADII = [5, 9, 13];        // concentric wave arcs at the cone mouth, ~4px apart
const ARC_THRESHOLDS = [0.05, 0.4, 0.75]; // value at which each arc lights up (0 arcs below the first)
const ARC_SPAN_DEG = 55;   // arcs sweep -55°..55° around the cone's axis
const ARC_GAP = 8;         // gap between the outermost arc and the track

// Horizontal volume slider, top-right in every scene except the transient BootScene,
// on the same row as and immediately left of the fullscreen button. Drives the
// game-global sound manager volume directly (scene.sound.volume) — the same instance
// every scene sees, and the one BootScene seeds from localStorage on launch. Visuals:
// a speaker icon whose wave arcs light up with the level (drawn, no unicode 🔊 — font
// support unreliable, same reasoning as FullscreenButton.js:15), a rounded track, and a
// ring-stroked knob. Shares the HUD look (config/ui.js) with FullscreenButton.
//
// `rightEdge` is the right boundary of the whole widget *including* the knob's
// overhang at value 1 — pass what addFullscreenButton returned so the row packs
// right-to-left; the default is the bare corner anchor.
export function addVolumeSlider(scene, rightEdge = HUD_CORNER_X) {
  // Layout, right-aligned at rightEdge: icon, arcs, gap, track, knob overhang
  const trackRight = rightEdge - KNOB_RADIUS;
  const trackLeft = trackRight - TRACK_W;
  const coneMouthX = trackLeft - ARC_GAP - ARC_RADII[ARC_RADII.length - 1];
  const iconLeft = coneMouthX - ICON_W;

  // Read the cache, not scene.sound.volume — the manager read is stale while
  // the audio context is still locked (pre-gesture)
  let value = getUserVolume();
  let dragId = null;   // pointer.id currently dragging the knob, or null
  let hovering = false;

  // Speaker icon — body rectangle + cone trapezoid, static (drawn once)
  const icon = hudPart(scene.add.graphics());
  icon.fillStyle(COLOR_LIGHT, 1);
  icon.fillRect(iconLeft, SLIDER_Y - ICON_BODY_H / 2, ICON_BODY_W, ICON_BODY_H);
  icon.fillPoints([
    { x: iconLeft + ICON_BODY_W, y: SLIDER_Y - ICON_BODY_H / 2 },
    { x: coneMouthX, y: SLIDER_Y - ICON_H / 2 },
    { x: coneMouthX, y: SLIDER_Y + ICON_H / 2 },
    { x: iconLeft + ICON_BODY_W, y: SLIDER_Y + ICON_BODY_H / 2 },
  ], true);

  // Wave arcs — redrawn per volume change, so the arc count doubles as a level readout
  const arcs = hudPart(scene.add.graphics());
  const drawArcs = () => {
    arcs.clear();
    arcs.lineStyle(2, COLOR_LIGHT, 1);
    for (let i = 0; i < ARC_RADII.length; i++) {
      if (value < ARC_THRESHOLDS[i]) break;
      arcs.beginPath();
      arcs.arc(
        coneMouthX, SLIDER_Y, ARC_RADII[i],
        Phaser.Math.DegToRad(-ARC_SPAN_DEG), Phaser.Math.DegToRad(ARC_SPAN_DEG)
      );
      arcs.strokePath();
    }
  };

  // Track — dark rounded base with a mid-grey outline, light fill up to the value
  const track = hudPart(scene.add.graphics());
  const drawTrack = () => {
    track.clear();
    track.fillStyle(COLOR_DARK, 1);
    track.fillRoundedRect(trackLeft, SLIDER_Y - TRACK_H / 2, TRACK_W, TRACK_H, TRACK_RADIUS);
    track.lineStyle(1, COLOR_MID, 1);
    track.strokeRoundedRect(trackLeft, SLIDER_Y - TRACK_H / 2, TRACK_W, TRACK_H, TRACK_RADIUS);
    const fillW = value * TRACK_W;
    // A rounded rect narrower than its corner diameter draws artifacts — skip the sliver
    if (fillW >= TRACK_RADIUS * 2) {
      track.fillStyle(COLOR_LIGHT, 1);
      track.fillRoundedRect(trackLeft, SLIDER_Y - TRACK_H / 2, fillW, TRACK_H, TRACK_RADIUS);
    }
  };

  const knob = hudPart(
    scene.add.circle(trackLeft + value * TRACK_W, SLIDER_Y, KNOB_RADIUS, COLOR_LIGHT).setStrokeStyle(2, COLOR_DARK)
  );

  drawArcs();
  drawTrack();

  const parts = [icon, arcs, track, knob];

  const apply = () => {
    scene.sound.setVolume(value); // also emits GLOBAL_VOLUME, which IntroScene uses for the video
    setUserVolume(value);         // keep the cache in step — it's the read source of truth
    knob.setX(trackLeft + value * TRACK_W);
    drawTrack();
    drawArcs();
  };

  // Value from the pointer's worldX (not x): cameras never scroll here so the two
  // normally agree, but GameScene's rotate/disco sections spin and zoom the main
  // camera, and worldX inverse-maps through that transform so the (also rotated)
  // slider still tracks the finger correctly.
  const setValueFromPointer = (pointer) => {
    value = Phaser.Math.Clamp((pointer.worldX - trackLeft) / TRACK_W, 0, 1);
    apply();
  };

  const zoneRight = trackRight + KNOB_RADIUS; // cover the knob's overhang at value 1
  const zoneX = (iconLeft + zoneRight) / 2;
  const zoneWidth = zoneRight - iconLeft;
  const zone = scene.add.zone(zoneX, SLIDER_Y, zoneWidth, HUD_HIT)
    .setDepth(HUD_DEPTH)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  zone.on('pointerover', () => {
    hovering = true;
    parts.forEach((part) => part.setAlpha(HUD_ALPHA_BRIGHT));
  });
  zone.on('pointerout', () => {
    hovering = false;
    if (dragId === null) parts.forEach((part) => part.setAlpha(HUD_ALPHA_DIM)); // stay bright mid-drag
  });

  const endDrag = (pointer) => {
    if (pointer.id !== dragId) return;
    dragId = null;
    saveUserVolume();
    if (!hovering) parts.forEach((part) => part.setAlpha(HUD_ALPHA_DIM));
  };

  // stopPropagation is mandatory on both handlers: without it a tap here also
  // reaches scene-level listeners — the player's touch tap/swipe tracking,
  // IntroScene's skip, GameOverScene's restart chain, HowToPlayScene's back.
  zone.on('pointerdown', (pointer, localX, localY, event) => {
    event.stopPropagation();
    dragId = pointer.id;
    setValueFromPointer(pointer); // tap-to-set
  });
  zone.on('pointerup', (pointer, localX, localY, event) => {
    // stopPropagation also cancels the scene-level POINTER_UP for this pointer
    // (InputPlugin gates it on the event not being cancelled), so a release on
    // the zone must end the drag right here — the listeners below never fire.
    event.stopPropagation();
    endDrag(pointer);
  });

  // Manual per-pointer drag tracking at the scene level, not Phaser's built-in
  // `draggable` — the drag must keep working once the finger leaves the small zone.
  const onPointerMove = (pointer) => {
    if (pointer.id !== dragId) return;
    // Released over another stopPropagating object (e.g. the fullscreen button):
    // that swallowed the scene-level up, so catch the stale drag here.
    if (!pointer.isDown) {
      endDrag(pointer);
      return;
    }
    setValueFromPointer(pointer);
  };
  // A scene-level down reusing dragId means the up was swallowed and the touch id
  // recycled for a new gesture (our own zone's down never reaches scene level) —
  // end the stale drag so the new gesture doesn't move the volume.
  bindPointer(scene, { down: endDrag, move: onPointerMove, up: endDrag });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    // Scene torn down mid-drag (e.g. the song COMPLETE fires while dragging) — save anyway
    if (dragId !== null) saveUserVolume();
  });
}
