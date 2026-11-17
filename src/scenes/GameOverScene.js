import Phaser from 'phaser';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { Confetti } from '../objects/Confetti.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss, onDirectionKey } from '../input.js';
import { getDifficulty } from '../difficulty.js';
import { CAUGHT_IMAGE } from '../config/gameConfig.js';
import { t } from '../i18n.js';
import { shareText, sharePlatforms, canShareFiles, openShare, shareSheet, saveImage, captureCanvas } from '../share.js';

const BUTTON_PADDING = { x: 28, y: 8 }; // widens the touch target beyond the glyphs
// ↑/↓ are gameplay keys, so a dodge mashed at the moment of death would otherwise
// move the selection off Restart before the player has even seen the screen.
const SELECT_GRACE_MS = 400;
// The shared screenshot is taken once the texts (and a win's confetti) are in the
// frame, ahead of any tap: navigator.share needs the tap's user activation, which
// would be gone if the capture were awaited after it.
const SNAPSHOT_DELAY_MS = 700;
// Brand glyphs (Simple Icons) in brand colours — X and Threads are monochrome
// brands, so white on this dark screen; Instagram carries its gradient — plus a
// generic share glyph for the system share sheet. Loaded by BootScene; the row
// shows the subset `sharePlatforms` picks.
export const SHARE_ICONS = [
  { platform: 'sheet', key: 'icon-share', file: 'assets/icons/share.svg' },
  { platform: 'x', key: 'icon-x', file: 'assets/icons/x.svg' },
  { platform: 'threads', key: 'icon-threads', file: 'assets/icons/threads.svg' },
  { platform: 'ig', key: 'icon-instagram', file: 'assets/icons/instagram.svg' },
];
export const SHARE_ICON_TEXTURE_PX = 64; // rasterised at 2x+ of the displayed size
const SHARE_ICON_PX = 28;
const SHARE_ICON_HIT_PX = 56;  // touch target, larger than the glyph
const SHARE_ICON_GAP = 72;
const SHARE_ICON_TINT = 0xbbbbbb; // multiplied onto the art: slightly dimmed until hovered
const CAUGHT_OUTLINE = { stroke: '#000000', strokeThickness: 6 }; // keeps text readable on the bright picture
// Loss layout (800x450): title and welcome line on top, the group picture's faces
// (y ~125-240) left clear, stats and buttons below them.
const LOSS_Y = { title: 40, message: 95, stats: 315, restart: 355, menu: 395 };
const SHARE_MARGIN = 24;
const CAUGHT_MESSAGE_STYLE = { fontSize: '30px', color: '#ffffff', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 5 };

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

    this.outline = this.won ? {} : CAUGHT_OUTLINE;
    const y = this.won
      ? { title: cy - 70, stats: cy - 10, restart: cy + 45, menu: cy + 95 }
      : LOSS_Y;

    // A lost run is shown over the chasers' group picture with a welcome line
    // (the player is one of them now); a win keeps the plain dark screen.
    if (!this.won) {
      this.add.image(0, 0, CAUGHT_IMAGE.key).setOrigin(0, 0)
        .setDisplaySize(this.scale.width, this.scale.height).setDepth(-2);
      this.add.text(cx, y.message, t('caught.message'), textStyle(CAUGHT_MESSAGE_STYLE))
        .setOrigin(0.5);
    }

    this.add.text(cx, y.title, t(this.won ? 'gameOver.clear' : 'gameOver.over'), textStyle({
      ...TITLE_STYLE,
      ...this.outline,
      color: this.won ? '#66ff88' : '#ffdd44',
    })).setOrigin(0.5);

    const pct = Math.floor(this.progress * 100);
    const stats = t('gameOver.stats', { pct, score: this.score, difficulty: t(`difficulty.${getDifficulty()}`) });
    this.add.text(cx, y.stats, stats, textStyle({ ...CAPTION_STYLE, fontSize: '22px', ...(this.won ? {} : { color: '#ffffff' }), ...this.outline })).setOrigin(0.5);

    const restart = () => this.scene.start('GameScene');
    const toMenu = () => this.scene.start('MenuScene');
    this.isDesktop = isDesktop(this);
    this.selected = 0;
    this.buttons = [];
    this.addButton(cx, y.restart, t('gameOver.restart'), { fontSize: '22px', color: '#ffffff' }, restart);
    this.addButton(cx, y.menu, t('gameOver.menu'), { fontSize: '22px', color: this.won ? '#aaaaaa' : '#ffffff' }, toMenu);
    this.highlight();
    this.addShareRow();

    if (this.isDesktop) {
      this.add.text(cx, this.scale.height - 30, t('gameOver.hint'), textStyle({ ...HINT_STYLE, ...this.outline }))
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
  // Tucked into the bottom-right corner so it takes no room from the layout.
  addShareRow() {
    const right = this.scale.width - SHARE_MARGIN;
    const y = this.scale.height - SHARE_MARGIN;
    const pct = Math.floor(this.progress * 100);
    const text = shareText({ won: this.won, score: this.score, pct, difficulty: getDifficulty() });
    this.notice = this.add.text(right, y - 32, t('share.saved'), textStyle({ fontSize: '14px', color: '#88cc99', ...this.outline }))
      .setOrigin(1, 0.5)
      .setVisible(false);

    const platforms = sharePlatforms(!this.isDesktop && canShareFiles());
    const icons = SHARE_ICONS.filter(({ platform }) => platforms.includes(platform));
    icons.forEach(({ platform, key }, i) => {
      const onTap = () => this.share(platform, text);
      const icon = this.add.image(right - SHARE_ICON_PX / 2 - (icons.length - 1 - i) * SHARE_ICON_GAP, y, key)
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

  // The generic icon (touch devices whose share sheet takes files) hands the
  // pre-captured screenshot + text to the system share sheet — the only way a
  // web page can attach an image — and the player picks the app there. The
  // brand icons, shown everywhere else: X / Threads open their text-only
  // composer and Instagram, which has no web composer, saves the PNG to post by hand.
  async share(platform, text) {
    if (platform === 'sheet') {
      await shareSheet(this.snapshot, text);
      return;
    }
    if (platform !== 'ig') {
      openShare(platform, text);
      return;
    }
    const blob = this.snapshot ?? await this.capture();
    if (!blob) return;
    saveImage(blob);
    if (this.notice?.active) this.notice.setVisible(true);
  }

  // Tappable label, selectable with ↑/↓ on desktop.
  addButton(x, y, label, style, onTap) {
    const text = this.add.text(x, y, label, textStyle({ ...style, ...this.outline, padding: BUTTON_PADDING }))
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
      text.setColor(i === this.selected ? '#ffffff' : (this.won ? '#666666' : '#cccccc'));
    });
  }

  update(time, delta) {
    if (this.confetti) this.confetti.update(delta);
  }
}
