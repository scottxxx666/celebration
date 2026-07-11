import { GAME_WIDTH } from '../config/gameConfig.js';

const ICON_SIZE = 18;    // full width/height of the expand-icon square
const BRACKET_LEN = 7;   // length of each corner L-bracket arm
const HIT_SIZE = 40;     // touch-friendly interactive hit area, centered on the icon
const MARGIN = 30;       // icon center offset from GAME_WIDTH / top
const ALPHA_DIM = 0.45;
const ALPHA_BRIGHT = 1;

// Fullscreen toggle button, top-right in every scene except the transient
// BootScene. Static expand icon only (four corner L-brackets, no unicode glyph —
// font support for ⛶ is unreliable) — no expand/compress swap, no ScaleManager
// listeners (YAGNI).
export function addFullscreenButton(scene) {
  // No Fullscreen API (e.g. iPhone Safari) — add nothing rather than a dead button.
  if (!scene.scale.fullscreen.available) return;

  const cx = GAME_WIDTH - MARGIN;
  const cy = MARGIN;
  const half = ICON_SIZE / 2;

  const icon = scene.add.graphics().setDepth(100).setScrollFactor(0); // harmless, cameras don't scroll
  icon.lineStyle(2, 0xffffff, 1);
  // Four corner L-brackets, each opening toward the icon's center.
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * half;
    const y = cy + sy * half;
    icon.beginPath();
    icon.moveTo(x, y - sy * BRACKET_LEN);
    icon.lineTo(x, y);
    icon.lineTo(x - sx * BRACKET_LEN, y);
    icon.strokePath();
  }
  icon.setAlpha(ALPHA_DIM);

  const zone = scene.add.zone(cx, cy, HIT_SIZE, HIT_SIZE)
    .setDepth(100)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  zone.on('pointerover', () => icon.setAlpha(ALPHA_BRIGHT));
  zone.on('pointerout', () => icon.setAlpha(ALPHA_DIM));
  // stopPropagation is mandatory on both handlers: without it a tap here also
  // reaches scene-level listeners — GameScene's POINTER_DOWN tap/swipe tracking,
  // IntroScene's skip, GameOverScene's restart chain.
  zone.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
  zone.on('pointerup', (pointer, localX, localY, event) => {
    event.stopPropagation();
    scene.scale.toggleFullscreen();
  });
}
