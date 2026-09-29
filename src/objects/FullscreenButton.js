import {
  HUD_CORNER_X,
  HUD_MARGIN,
  HUD_HIT,
  HUD_DEPTH,
  HUD_GAP,
  HUD_ALPHA_DIM,
  HUD_ALPHA_BRIGHT,
  KEYCAP_LIGHT_CSS,
  hudPart,
  addKeycap,
  isDesktop,
} from '../config/ui.js';

const ICON_SIZE = 18;    // full width/height of the expand-icon square (mobile only)
const BRACKET_LEN = 7;   // length of each corner L-bracket arm
const KEYCAP_SIZE = 18;  // mini "F" keycap square (desktop only)
const KEYCAP_GAP = 4;    // gap between the keycap and the word

// Fullscreen toggle, top-right in every scene except the transient BootScene.
// Desktop is keyboard-first, so the whole button is a "[F] fullscreen" text label
// (keycap look shared with HowToPlayScene) — no icon. Mobile gets a static expand
// icon instead (four corner L-brackets, no unicode glyph — font support for ⛶ is
// unreliable) — no expand/compress swap, no ScaleManager listeners (YAGNI).
//
// Returns the x where the *next* top-right widget's right edge belongs, so the row
// packs right-to-left (see addVolumeSlider) — the button's own left edge minus a gap,
// or the bare corner anchor when no button was added. Callers that add another widget
// on this row must therefore call this one first.
export function addFullscreenButton(scene) {
  // No Fullscreen API (e.g. iPhone Safari) — add nothing rather than a dead button.
  // The corner is then free, so the next widget gets the full anchor.
  if (!scene.scale.fullscreen.available) return HUD_CORNER_X;

  const cx = HUD_CORNER_X;
  const cy = HUD_MARGIN;

  const parts = [];
  let zoneX = cx;
  let zoneWidth = HUD_HIT;

  if (isDesktop(scene)) {
    // Word right-aligned where the icon's right edge would sit, keycap to its left.
    const wordText = hudPart(
      scene.add.text(cx + ICON_SIZE / 2, cy, 'fullscreen', { fontSize: '11px', color: KEYCAP_LIGHT_CSS })
        .setOrigin(1, 0.5)
    );
    const keyCx = wordText.x - wordText.width - KEYCAP_GAP - KEYCAP_SIZE / 2;
    const { bg, text } = addKeycap(scene, 'F', { size: KEYCAP_SIZE, fontSize: '11px', stroke: 1 });
    hudPart(bg.setPosition(keyCx, cy));
    hudPart(text.setPosition(keyCx, cy));
    parts.push(bg, text, wordText);

    const zoneLeft = keyCx - KEYCAP_SIZE / 2;
    const zoneRight = cx + HUD_HIT / 2;
    zoneX = (zoneLeft + zoneRight) / 2;
    zoneWidth = zoneRight - zoneLeft;
  } else {
    const half = ICON_SIZE / 2;
    const icon = hudPart(scene.add.graphics());
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
    parts.push(icon);
  }

  const zone = scene.add.zone(zoneX, cy, zoneWidth, HUD_HIT)
    .setDepth(HUD_DEPTH)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  zone.on('pointerover', () => parts.forEach((part) => part.setAlpha(HUD_ALPHA_BRIGHT)));
  zone.on('pointerout', () => parts.forEach((part) => part.setAlpha(HUD_ALPHA_DIM)));
  // stopPropagation is mandatory on both handlers: without it a tap here also
  // reaches scene-level listeners — the player's touch tap/swipe tracking,
  // IntroScene's skip, GameOverScene's restart chain.
  zone.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
  zone.on('pointerup', (pointer, localX, localY, event) => {
    event.stopPropagation();
    scene.scale.toggleFullscreen();
  });

  return zoneX - zoneWidth / 2 - HUD_GAP;
}
