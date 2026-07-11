import { GAME_WIDTH } from '../config/gameConfig.js';

const ICON_SIZE = 18;    // full width/height of the expand-icon square (mobile only)
const BRACKET_LEN = 7;   // length of each corner L-bracket arm
const HIT_SIZE = 40;     // touch-friendly interactive hit area height / mobile width
const MARGIN = 30;       // anchor center offset from GAME_WIDTH / top
const ALPHA_DIM = 0.45;
const ALPHA_BRIGHT = 1;
const KEYCAP_SIZE = 18;  // mini "F" keycap square (desktop only)
const KEYCAP_GAP = 4;    // gap between the keycap and the word

// Fullscreen toggle, top-right in every scene except the transient BootScene.
// Desktop is keyboard-first, so the whole button is a "[F] fullscreen" text label
// (colours match HowToPlayScene's keycaps) — no icon. Mobile gets a static expand
// icon instead (four corner L-brackets, no unicode glyph — font support for ⛶ is
// unreliable) — no expand/compress swap, no ScaleManager listeners (YAGNI).
export function addFullscreenButton(scene) {
  // No Fullscreen API (e.g. iPhone Safari) — add nothing rather than a dead button.
  if (!scene.scale.fullscreen.available) return;

  const cx = GAME_WIDTH - MARGIN;
  const cy = MARGIN;

  const parts = [];
  let zoneX = cx;
  let zoneWidth = HIT_SIZE;

  if (scene.sys.game.device.os.desktop) {
    // Word right-aligned where the icon's right edge would sit, keycap to its left.
    const wordText = scene.add.text(cx + ICON_SIZE / 2, cy, 'fullscreen', {
      fontSize: '11px',
      color: '#dddddd',
    }).setOrigin(1, 0.5).setDepth(100).setScrollFactor(0).setAlpha(ALPHA_DIM);
    const keyCx = wordText.x - wordText.width - KEYCAP_GAP - KEYCAP_SIZE / 2;
    const keycap = scene.add.rectangle(keyCx, cy, KEYCAP_SIZE, KEYCAP_SIZE, 0x2f2f44)
      .setStrokeStyle(1, 0x777788)
      .setDepth(100).setScrollFactor(0).setAlpha(ALPHA_DIM);
    const keyLabel = scene.add.text(keyCx, cy, 'F', {
      fontSize: '11px',
      color: '#dddddd',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(ALPHA_DIM);
    parts.push(keycap, keyLabel, wordText);

    const zoneLeft = keyCx - KEYCAP_SIZE / 2;
    const zoneRight = cx + HIT_SIZE / 2;
    zoneX = (zoneLeft + zoneRight) / 2;
    zoneWidth = zoneRight - zoneLeft;
  } else {
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
    parts.push(icon);
  }

  const zone = scene.add.zone(zoneX, cy, zoneWidth, HIT_SIZE)
    .setDepth(100)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  zone.on('pointerover', () => parts.forEach((part) => part.setAlpha(ALPHA_BRIGHT)));
  zone.on('pointerout', () => parts.forEach((part) => part.setAlpha(ALPHA_DIM)));
  // stopPropagation is mandatory on both handlers: without it a tap here also
  // reaches scene-level listeners — GameScene's POINTER_DOWN tap/swipe tracking,
  // IntroScene's skip, GameOverScene's restart chain.
  zone.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
  zone.on('pointerup', (pointer, localX, localY, event) => {
    event.stopPropagation();
    scene.scale.toggleFullscreen();
  });
}
