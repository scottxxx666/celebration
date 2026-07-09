import Phaser from 'phaser';
import { Confetti } from '../objects/Confetti.js';

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
      fontSize: '48px',
      color: this.won ? '#66ff88' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const pct = Math.floor(this.progress * 100);
    this.add.text(cx, cy + 10, `Song progress: ${pct}% · ${this.score}s`, {
      fontSize: '22px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 55, 'Press SPACE to restart · ESC for menu', {
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5);

    // Celebrate a clear with a one-shot confetti-cannon pop
    if (this.won) {
      this.confetti = new Confetti(this);
      this.confetti.burst();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.confetti.destroy());
    }

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }

  update(time, delta) {
    if (this.confetti) this.confetti.update(delta);
  }
}
