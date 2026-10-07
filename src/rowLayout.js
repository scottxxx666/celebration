import {
  NUM_ROWS,
  ROW_HEIGHT,
  WALK_ZONE_TOP,
  ROW_SCALE_BACK,
  ROW_SCALE_FRONT,
  LIGHTS_OUT_SHADOW_COLOR,
  LIGHTS_OUT_SHADOW_ALPHA,
  LIGHTS_OUT_SHADOW_DEPTH,
} from './config/gameConfig.js';

// Fake-3D ground plane (docs/art-brief.md): each row maps to a center y, a
// visual scale (back rows smaller), and a render depth (front rows draw over
// back rows). Visual only — collision boxes are never scaled. Computed once
// per row; callers must treat the returned object as read-only.
const LAYOUTS = Array.from({ length: NUM_ROWS }, (_, row) => ({
  y: WALK_ZONE_TOP + ROW_HEIGHT * row + ROW_HEIGHT / 2,
  scale: ROW_SCALE_BACK + ((ROW_SCALE_FRONT - ROW_SCALE_BACK) * row) / (NUM_ROWS - 1),
  depth: row,
}));

export function rowLayout(row) {
  return LAYOUTS[row];
}

// Uniform scale that fits an image's texture height to a logical half-height
// `hh` at front-row size, then applies the row's fake-3D scale.
export function fitSpriteScale(image, hh, rowScale) {
  return ((hh * 2) / image.height) * rowScale;
}

// Drop-shadow ellipse for an object of half-width hw. Caller positions it at
// the object's base each frame and gives it depth row − 0.5, so it draws under
// everything standing on its own row but over anything in the row behind.
const SHADOW_ALPHA = 0.3;

export function addShadow(scene, hw, alpha = SHADOW_ALPHA) {
  return scene.add.ellipse(0, 0, hw * 2.2, 14, 0x000000, alpha);
}

// Per-frame shadow look for an object on a row of depth `rowDepth`: normally the
// dark ellipse at row − 0.5; with `glow` (lights-out dark beats) a light ellipse
// lifted above the blackout overlay, the only thing left visible.
export function styleShadow(shadow, rowDepth, glow, alpha = SHADOW_ALPHA) {
  if (glow) {
    shadow.setFillStyle(LIGHTS_OUT_SHADOW_COLOR, LIGHTS_OUT_SHADOW_ALPHA).setDepth(LIGHTS_OUT_SHADOW_DEPTH);
  } else {
    shadow.setFillStyle(0x000000, alpha).setDepth(rowDepth - 0.5);
  }
}

// Tint a sprite solid black (lights-out silhouettes) or restore it. No-op for
// the placeholder rectangles, which can't be tinted.
export function styleSilhouette(sprite, on) {
  if (!sprite.setTint) return;
  if (on) sprite.setTint(0x000000);
  else sprite.clearTint();
}
