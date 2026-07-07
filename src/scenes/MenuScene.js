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

    this.helpOpen = false;
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
          if (this.helpOpen) return;
          this.selected = i;
          this.highlight();
        })
        .on('pointerup', () => {
          if (this.helpOpen) return;
          this.selected = i;
          this.confirm();
        })
    );
    this.highlight();

    this.add.text(cx, GAME_HEIGHT - 30, '↑/↓ select · ENTER confirm', {
      fontSize: '14px',
      color: '#555555',
    }).setOrigin(0.5);

    this.helpPanel = this.buildHelpPanel(cx, cy);

    this.input.keyboard.on('keydown-UP', () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard.on('keydown-ESC', () => this.closeHelp());
  }

  buildHelpPanel(cx, cy) {
    const lines = [
      'Alternate ← → to run faster',
      'Press ↑ ↓ to change rows',
      'Dodge the obstacles',
      "Don't let the chaser catch you",
    ];
    const panel = this.add.container(cx, cy, [
      this.add.rectangle(0, 0, 520, 260, 0x1a1a2e, 0.95).setStrokeStyle(2, 0x88aa66),
      this.add.text(0, -95, 'HOW TO PLAY', { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5),
      ...lines.map((line, i) =>
        this.add.text(0, -40 + i * 32, line, { fontSize: '18px', color: '#aaaaaa' }).setOrigin(0.5)
      ),
      this.add.text(0, 105, 'Press ESC or ENTER to go back', { fontSize: '14px', color: '#666666' }).setOrigin(0.5),
    ]);
    panel.setVisible(false);
    return panel;
  }

  highlight() {
    this.optionTexts.forEach((text, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
      text.setText(i === this.selected ? `▶ ${OPTIONS[i]}` : OPTIONS[i]);
    });
  }

  move(dir) {
    if (this.helpOpen) return;
    this.selected = Phaser.Math.Wrap(this.selected + dir, 0, OPTIONS.length);
    this.highlight();
  }

  confirm() {
    if (this.helpOpen) {
      this.closeHelp();
      return;
    }
    if (this.selected === 0) {
      this.startGame();
    } else {
      this.helpOpen = true;
      this.helpPanel.setVisible(true);
    }
  }

  closeHelp() {
    this.helpOpen = false;
    this.helpPanel.setVisible(false);
  }

  startGame() {
    // The confirming gesture unlocks the browser audio context; wait for the
    // unlock so GameScene's music clock is valid from its first frame (C3).
    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.scene.start('GameScene'));
    } else {
      this.scene.start('GameScene');
    }
  }
}
