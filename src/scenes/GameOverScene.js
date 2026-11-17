import Phaser from 'phaser';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { Confetti } from '../objects/Confetti.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss, onDirectionKey } from '../input.js';
import { getDifficulty } from '../difficulty.js';
import { t } from '../i18n.js';
import { shareText, openShare, shareImage, captureCanvas } from '../share.js';

const BUTTON_PADDING = { x: 28, y: 8 }; // widens the touch target beyond the glyphs
// ↑/↓ are gameplay keys, so a dodge mashed at the moment of death would otherwise
// move the selection off Restart before the player has even seen the screen.
const SELECT_GRACE_MS = 400;
// The IG screenshot is taken once the texts (and a win's confetti) are in the
// frame, ahead of any tap: navigator.share needs the tap's user activation, which
// would be gone if the capture were awaited after it.
const SNAPSHOT_DELAY_MS = 700;
// Brand glyphs (Simple Icons) in brand colours — X and Threads are monochrome
// brands, so white on this dark screen; Instagram carries its gradient. Loaded by BootScene.
export const SHARE_ICONS = [
  { platform: 'x', key: 'icon-x', file: 'assets/icons/x.svg' },
  { platform: 'threads', key: 'icon-threads', file: 'assets/icons/threads.svg' },
  { platform: 'ig', key: 'icon-instagram', file: 'assets/icons/instagram.svg' },
];
export const SHARE_ICON_TEXTURE_PX = 64; // rasterised at 2x+ of the displayed size
const SHARE_ICON_PX = 28;
const SHARE_ICON_HIT_PX = 56;  // touch target, larger than the glyph
const SHARE_ICON_GAP = 72;
const SHARE_ICON_TINT = 0xbbbbbb; // multiplied onto the art: slightly dimmed until hovered

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.won = data.won ?? false;
    this.score = data.score ?? 0;
    this.progress = data.progress ?? 0;
    // Scene instances are reused across restarts — clear any stale burst from a prior win
    this.confetti = null;
    this.snapshot = null;
    this.snapshotPending = null;
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 70, t(this.won ? 'gameOver.clear' : 'gameOver.over'), textStyle({
      ...TITLE_STYLE,
      color: this.won ? '#66ff88' : '#ffffff',
    })).setOrigin(0.5);

    const pct = Math.floor(this.progress * 100);
    const stats = t('gameOver.stats', { pct, score: this.score, difficulty: t(`difficulty.${getDifficulty()}`) });
    this.add.text(cx, cy - 10, stats, textStyle({ ...CAPTION_STYLE, fontSize: '22px' })).setOrigin(0.5);

    const restart = () => this.scene.start('GameScene');
    const toMenu = () => this.scene.start('MenuScene');
    this.isDesktop = isDesktop(this);
    this.selected = 0;
    this.buttons = [];
    this.addButton(cx, cy + 45, t('gameOver.restart'), { fontSize: '28px', color: '#ffffff' }, restart);
    this.addButton(cx, cy + 95, t('gameOver.menu'), { fontSize: '22px', color: '#aaaaaa' }, toMenu);
    this.highlight();
    this.addShareRow(cx, cy + 143);

    if (this.isDesktop) {
      this.add.text(cx, this.scale.height - 30, t('gameOver.hint'), textStyle(HINT_STYLE))
        .setOrigin(0.5);

      let canSelect = false;
      this.time.delayedCall(SELECT_GRACE_MS, () => { canSelect = true; });
      const move = (dir) => (event) => {
        if (!canSelect || event.repeat) return;
        this.selected = Phaser.Math.Wrap(this.selected + dir, 0, this.buttons.length);
        this.highlight();
      };
      onDirectionKey(this, 'up', move(-1));
      onDirectionKey(this, 'down', move(1));
    }

    // Celebrate a clear with a one-shot confetti-cannon pop
    if (this.won) {
      this.confetti = new Confetti(this);
      this.confetti.burst();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.confetti.destroy());
    }

    const confirm = () => this.buttons[this.selected].onTap();
    onDismiss(this, { keys: { SPACE: confirm, ENTER: confirm, ESC: toMenu } });

    addFullscreenButton(this);
  }

  // Pointer-only icons: not part of the ↑/↓ selection, so SPACE still retries.
  addShareRow(cx, y) {
    const pct = Math.floor(this.progress * 100);
    const text = shareText({ won: this.won, score: this.score, pct, difficulty: getDifficulty() });
    this.notice = this.add.text(cx, y + 32, t('share.saved'), textStyle({ fontSize: '14px', color: '#88cc99' }))
      .setOrigin(0.5)
      .setVisible(false);

    SHARE_ICONS.forEach(({ platform, key }, i) => {
      const onTap = platform === 'ig' ? () => this.shareStory(text) : () => openShare(platform, text);
      const icon = this.add.image(cx + (i - (SHARE_ICONS.length - 1) / 2) * SHARE_ICON_GAP, y, key)
        .setDisplaySize(SHARE_ICON_PX, SHARE_ICON_PX)
        .setTint(SHARE_ICON_TINT);
      // The hit area is in texture pixels, centred on the glyph
      const hit = SHARE_ICON_HIT_PX * (SHARE_ICON_TEXTURE_PX / SHARE_ICON_PX);
      const inset = (SHARE_ICON_TEXTURE_PX - hit) / 2;
      icon.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(inset, inset, hit, hit),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      if (this.isDesktop) {
        icon.on('pointerover', () => icon.setTint(0xffffff));
        icon.on('pointerout', () => icon.setTint(SHARE_ICON_TINT));
      }
      this.armTap(icon, onTap);
    });

    this.time.delayedCall(SNAPSHOT_DELAY_MS, () => this.capture());
  }

  capture() {
    this.snapshotPending ??= captureCanvas(this.game).then((blob) => {
      this.snapshot = blob;
      this.snapshotPending = null;
      return blob;
    });
    return this.snapshotPending;
  }

  // Normally the stored blob is shared synchronously; if the tap beat the
  // pre-capture, capture now (the share sheet may then refuse the lost
  // activation, in which case the PNG is downloaded instead).
  async shareStory(text) {
    const blob = this.snapshot ?? await this.capture();
    if (!blob) return;
    const result = await shareImage(blob, text, { preferSheet: !this.isDesktop });
    if (result === 'saved' && this.notice?.active) this.notice.setVisible(true);
  }

  // Tappable label, selectable with ↑/↓ on desktop.
  addButton(x, y, label, style, onTap) {
    const text = this.add.text(x, y, label, textStyle({ ...style, padding: BUTTON_PADDING }))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const index = this.buttons.push({ text, onTap }) - 1;
    if (this.isDesktop) {
      text.on('pointerover', () => {
        this.selected = index;
        this.highlight();
      });
    }
    this.armTap(text, onTap);
  }

  // `onTap` fires only when the press began on `target` itself: a finger still
  // held from the death tap and released over it must not spend it.
  armTap(target, onTap) {
    let armed = false;
    target.on('pointerdown', () => {
      armed = true;
      target.setAlpha(0.6);
    });
    target.on('pointerout', () => {
      armed = false;
      target.setAlpha(1);
    });
    target.on('pointerup', () => {
      if (armed) onTap();
    });
  }

  // Desktop marks the selected label by colour alone, like MenuScene.
  highlight() {
    if (!this.isDesktop) return;

    this.buttons.forEach(({ text }, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
    });
  }

  update(time, delta) {
    if (this.confetti) this.confetti.update(delta);
  }
}
