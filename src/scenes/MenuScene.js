import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

const OPTIONS = ['Start', 'How to Play'];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.selected = 0;

    this.add.text(cx, cy - 110, 'CELEBRATION', {
      fontSize: '56px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.optionTexts = OPTIONS.map((label, i) =>
      this.add.text(cx, cy + i * 45, label, { fontSize: '26px', color: '#666666' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selected = i;
          this.highlight();
        })
        .on('pointerup', () => {
          this.selected = i;
          this.confirm();
        })
    );
    this.highlight();

    this.isDesktop = this.sys.game.device.os.desktop;

    this.add.text(cx, GAME_HEIGHT - 30, this.isDesktop ? '↑/↓ select · ENTER confirm' : 'Tap an option', {
      fontSize: '14px',
      color: '#555555',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-UP', () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
  }

  highlight() {
    this.optionTexts.forEach((text, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
      text.setText(i === this.selected ? `▶ ${OPTIONS[i]}` : OPTIONS[i]);
    });
  }

  move(dir) {
    this.selected = Phaser.Math.Wrap(this.selected + dir, 0, OPTIONS.length);
    this.highlight();
  }

  confirm() {
    if (this.selected === 0) {
      this.startGame();
    } else {
      this.scene.start('HowToPlayScene');
    }
  }

  startGame() {
    // The confirming gesture unlocks the browser audio context; the intro plays
    // before gameplay, giving audio ample time to unlock (the actual unlock-wait
    // now guards the IntroScene -> GameScene hop).
    this.scene.start('IntroScene');
  }
}
