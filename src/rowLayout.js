import {
  NUM_ROWS,
  ROW_HEIGHT,
  WALK_ZONE_TOP,
  ROW_SCALE_BACK,
  ROW_SCALE_FRONT,
} from './config/gameConfig.js';

// Fake-3D ground plane (docs/art-brief.md): each row maps to a center y, a
// visual scale (back rows smaller), and a render depth (front rows draw over
// back rows). Visual only — collision boxes are never scaled.
export function rowLayout(row) {
  return {
    y: WALK_ZONE_TOP + ROW_HEIGHT * row + ROW_HEIGHT / 2,
    scale: ROW_SCALE_BACK + ((ROW_SCALE_FRONT - ROW_SCALE_BACK) * row) / (NUM_ROWS - 1),
    depth: row,
  };
}

// Drop-shadow ellipse for an object of half-width hw. Caller positions it at
// the object's base each frame and gives it depth row − 0.5, so it draws under
// everything standing on its own row but over anything in the row behind.
export function addShadow(scene, hw) {
  return scene.add.ellipse(0, 0, hw * 2.2, 14, 0x000000, 0.3);
}
