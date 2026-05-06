import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.score = data.score ?? 0;
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 50, 'GAME OVER', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, `Survived: ${this.score}s`, {
      fontSize: '22px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 55, 'Press SPACE to restart', {
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
