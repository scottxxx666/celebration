import { GAME_WIDTH } from './gameConfig.js';

// Shared look for the HUD widgets (FullscreenButton, VolumeSlider) and the
// keycap demos (HowToPlayScene), plus the text styles every scene draws with.

// Keycap palette: dark face, mid outline, light label
export const KEYCAP_DARK = 0x2f2f44;
export const KEYCAP_MID = 0x777788;
export const KEYCAP_LIGHT = 0xdddddd;
export const KEYCAP_LIGHT_CSS = '#dddddd';

// Top-right HUD row: anchor, layering, hover alpha, touch-friendly hit height
export const HUD_MARGIN = 30;                      // anchor center offset from GAME_WIDTH / top
export const HUD_CORNER_X = GAME_WIDTH - HUD_MARGIN; // right edge of the row's first widget
export const HUD_DEPTH = 100;
export const HUD_HIT = 40;
export const HUD_ALPHA_DIM = 0.45;
export const HUD_ALPHA_BRIGHT = 1;
export const HUD_GAP = 14;                         // gap between widgets on the row

// Apply the HUD layering + dim state to a freshly added visual (not a Zone — no alpha)
export function hudPart(obj) {
  return obj.setDepth(HUD_DEPTH).setScrollFactor(0).setAlpha(HUD_ALPHA_DIM);
}

// Keycap square with a centred label, both at (0, 0) — caller positions them
export function addKeycap(scene, label, { size, fontSize, stroke }) {
  const bg = scene.add.rectangle(0, 0, size, size, KEYCAP_DARK).setStrokeStyle(stroke, KEYCAP_MID);
  const text = scene.add.text(0, 0, label, { fontSize, color: KEYCAP_LIGHT_CSS }).setOrigin(0.5);
  return { bg, text };
}

export const TITLE_STYLE = { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' };
export const CAPTION_STYLE = { fontSize: '18px', color: '#aaaaaa' };
export const HINT_STYLE = { fontSize: '14px', color: '#666666' };

export function isDesktop(scene) {
  return scene.sys.game.device.os.desktop;
}
