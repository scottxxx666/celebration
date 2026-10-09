import Phaser from 'phaser';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, isDesktop } from '../config/ui.js';
import { Confetti } from '../objects/Confetti.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss, onDirectionKey } from '../input.js';
import { DIFFICULTIES, getDifficulty } from '../difficulty.js';

const BUTTON_PADDING = { x: 28, y: 8 }; // widens the touch target beyond the glyphs
// ↑/↓ are gameplay keys, so a dodge mashed at the moment of death would otherwise
// move the selection off Restart before the player has even seen the screen.
const SELECT_GRACE_MS = 400;

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
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 50, this.won ? 'CLEAR!' : 'GAME OVER', {
      ...TITLE_STYLE,
      color: this.won ? '#66ff88' : '#ffffff',
    }).setOrigin(0.5);

    const pct = Math.floor(this.progress * 100);
    this.add.text(cx, cy + 10, `Song progress: ${pct}% · ${this.score}s · ${DIFFICULTIES[getDifficulty()].label}`, {
      ...CAPTION_STYLE,
      fontSize: '22px',
    }).setOrigin(0.5);

    const restart = () => this.scene.start('GameScene');
    const toMenu = () => this.scene.start('MenuScene');
    this.isDesktop = isDesktop(this);
    this.selected = 0;
    this.buttons = [];
    this.addButton(cx, cy + 65, 'Restart', { fontSize: '28px', color: '#ffffff' }, restart);
    this.addButton(cx, cy + 115, 'Menu', { fontSize: '22px', color: '#aaaaaa' }, toMenu);
    this.highlight();

    if (this.isDesktop) {
      this.add.text(cx, this.scale.height - 30, '↑/↓ select · SPACE confirm · ESC menu', HINT_STYLE)
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

  // Tappable label. It fires only when the press began on the label itself: a
  // finger still held from the death tap and released over it must not spend it.
  addButton(x, y, label, style, onTap) {
    const text = this.add.text(x, y, label, { ...style, padding: BUTTON_PADDING })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const index = this.buttons.push({ text, onTap }) - 1;
    if (this.isDesktop) {
      text.on('pointerover', () => {
        this.selected = index;
        this.highlight();
      });
    }

    let armed = false;
    text.on('pointerdown', () => {
      armed = true;
      text.setAlpha(0.6);
    });
    text.on('pointerout', () => {
      armed = false;
      text.setAlpha(1);
    });
    text.on('pointerup', () => {
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
