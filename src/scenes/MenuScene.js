import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, HINT_STYLE, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { hasSeenHowToPlay } from '../seenHowToPlay.js';
import { getStartMs } from '../songTime.js';
import { onDirectionKey } from '../input.js';

const OPTIONS = ['Start', 'How to Play'];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.selected = 0;
    this.isDesktop = isDesktop(this);

    this.add.text(cx, cy - 110, 'CELEBRATION', { ...TITLE_STYLE, fontSize: '56px' }).setOrigin(0.5);

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
      this.isDesktop ? '↑/↓ select · SPACE confirm' : 'Tap an option',
      HINT_STYLE
    ).setOrigin(0.5);

    onDirectionKey(this, 'up', () => this.move(-1));
    onDirectionKey(this, 'down', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());

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
      // `next` must be passed explicitly: Phaser keeps the previous settings.data
      // when scene.start is called without any, so omitting it here would leave a
      // stale 'GameScene' from the first-run gate and send the player into the game.
      this.scene.start('HowToPlayScene', { next: 'MenuScene' });
    }
  }

  startGame() {
    // The confirming gesture unlocks the browser audio context; the intro plays
    // before gameplay, giving audio ample time to unlock (the actual unlock-wait
    // now guards the IntroScene -> GameScene hop).
    // Mobile: request fullscreen from this same gesture (the landscape lock hooks
    // onto enterfullscreen in main.js). iPhone has no Fullscreen API, so
    // `available` is false there and Start behaves exactly as before.
    if (!this.isDesktop && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }
    // Dev/testing deep-link (?t=): skip HowToPlay/Intro straight to gameplay.
    // The confirming gesture here still unlocks audio, which the music seek needs.
    if (getStartMs() > 0) {
      this.scene.start('GameScene');
      return;
    }
    // First run only: teach the controls before anything else, so Start leads
    // straight to them rather than into the video.
    if (hasSeenHowToPlay()) {
      this.scene.start('IntroScene');
    } else {
      this.scene.start('HowToPlayScene', { next: 'IntroScene' });
    }
  }
}
