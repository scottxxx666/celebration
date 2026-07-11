import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';

const OPTIONS = ['Start', 'How to Play'];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.selected = 0;

    this.isDesktop = this.sys.game.device.os.desktop;

    this.add.text(cx, cy - 110, 'CELEBRATION', {
      fontSize: '56px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.optionTexts = OPTIONS.map((label, i) => {
      const text = this.add.text(cx, cy + i * 45, label, {
        fontSize: '26px',
        color: this.isDesktop ? '#666666' : '#ffffff',
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      if (this.isDesktop) {
        text.on('pointerover', () => {
          this.selected = i;
          this.highlight();
        });
      } else {
        text
          .on('pointerdown', () => text.setAlpha(0.6))
          .on('pointerout', () => text.setAlpha(1));
      }

      text.on('pointerup', () => {
        text.setAlpha(1);
        this.selected = i;
        this.confirm();
      });

      return text;
    });

    if (this.isDesktop) {
      this.cursor = this.add.text(0, 0, '▶', { fontSize: '26px', color: '#ffffff' }).setOrigin(1, 0.5);
    }
    this.highlight();

    this.add.text(
      cx,
      GAME_HEIGHT - 30,
      this.isDesktop ? '↑/↓ select · ENTER confirm' : 'Tap an option',
      { fontSize: '14px', color: '#555555' }
    ).setOrigin(0.5);

    this.input.keyboard.on('keydown-UP', () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());

    if (!this.isDesktop) {
      // Orientation lock only works while fullscreen (Android/Chromium); iOS rejects it, so swallow failures.
      this.scale.once('enterfullscreen', () => {
        screen.orientation?.lock?.('landscape').catch(() => {});
      });
    }

    addFullscreenButton(this);
  }

  highlight() {
    if (!this.isDesktop) return;

    this.optionTexts.forEach((text, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
    });

    const label = this.optionTexts[this.selected];
    this.cursor.setPosition(label.getLeftCenter().x - 12, label.y);
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
    // Mobile: request fullscreen from this same gesture. iPhone has no Fullscreen API,
    // so `available` is false there and Start behaves exactly as before.
    if (!this.isDesktop && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }
    this.scene.start('IntroScene');
  }
}
