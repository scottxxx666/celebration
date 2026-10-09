import Phaser from 'phaser';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, isDesktop } from '../config/ui.js';
import { Confetti } from '../objects/Confetti.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss } from '../input.js';
import { DIFFICULTIES, getDifficulty } from '../difficulty.js';

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

    const hint = isDesktop(this) ? 'SPACE to restart · ESC for menu' : 'Tap to restart';
    this.add.text(cx, cy + 55, hint, { ...HINT_STYLE, fontSize: '18px' }).setOrigin(0.5);

    // Celebrate a clear with a one-shot confetti-cannon pop
    if (this.won) {
      this.confetti = new Confetti(this);
      this.confetti.burst();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.confetti.destroy());
    }

    const restart = () => this.scene.start('GameScene');
    onDismiss(this, {
      keys: { SPACE: restart, ESC: () => this.scene.start('MenuScene') },
      tap: restart,
    });

    addFullscreenButton(this);
  }

  update(time, delta) {
    if (this.confetti) this.confetti.update(delta);
  }
}
