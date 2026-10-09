import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { getStartMs } from '../songTime.js';
import { onDirectionKey } from '../input.js';
import { DIFFICULTIES, getDifficulty, setDifficulty, stepDifficulty } from '../difficulty.js';
import { menuRowLayout, MENU_CAPTION_OFFSET, MENU_TOUCH_WIDTH } from '../menuLayout.js';

const OPTIONS = ['Start', '', 'How to Play'];
const DIFFICULTY_ROW = 1; // label is set by refreshDifficulty()

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
      const { y, zoneY, zoneHeight } = menuRowLayout(i, DIFFICULTY_ROW);
      const text = this.add.text(cx, y, label, {
        fontSize: '26px',
        color: this.isDesktop ? '#666666' : '#ffffff',
      }).setOrigin(0.5);

      // Mobile taps land on an invisible zone much larger than the glyphs (the
      // text alone is under a fingertip tall once the canvas is scaled down);
      // desktop keeps the text itself so hover selects only over the label.
      const target = this.isDesktop
        ? text.setInteractive({ useHandCursor: true })
        : this.add.zone(cx, zoneY, MENU_TOUCH_WIDTH, zoneHeight).setInteractive();

      if (this.isDesktop) {
        target.on('pointerover', () => {
          this.selected = i;
          this.highlight();
        });
      } else {
        target
          .on('pointerdown', () => text.setAlpha(0.6))
          .on('pointerout', () => text.setAlpha(1));
      }

      target.on('pointerup', () => {
        text.setAlpha(1);
        this.selected = i;
        this.confirm();
      });

      return text;
    });

    this.difficultyCaption = this.add
      .text(cx, this.optionTexts[DIFFICULTY_ROW].y + MENU_CAPTION_OFFSET, '', { ...CAPTION_STYLE, fontSize: '14px' })
      .setOrigin(0.5);
    this.refreshDifficulty();
    this.highlight();

    this.add.text(
      cx,
      GAME_HEIGHT - 30,
      this.isDesktop ? '↑/↓ select · ←/→ mode · SPACE confirm' : 'Tap an option',
      HINT_STYLE
    ).setOrigin(0.5);

    onDirectionKey(this, 'up', () => this.move(-1));
    onDirectionKey(this, 'down', () => this.move(1));
    onDirectionKey(this, 'left', () => this.cycleDifficulty(-1));
    onDirectionKey(this, 'right', () => this.cycleDifficulty(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());

    addFullscreenButton(this);
  }

  highlight() {
    if (!this.isDesktop) return;

    this.optionTexts.forEach((text, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
    });
  }

  // Relabels the Difficulty row and its caption from the stored value.
  refreshDifficulty() {
    const { label, caption } = DIFFICULTIES[getDifficulty()];
    this.optionTexts[DIFFICULTY_ROW].setText(`◀ ${label} ▶`);
    this.difficultyCaption.setText(caption);
  }

  cycleDifficulty(dir) {
    setDifficulty(stepDifficulty(getDifficulty(), dir));
    this.refreshDifficulty();
  }

  move(dir) {
    this.selected = Phaser.Math.Wrap(this.selected + dir, 0, OPTIONS.length);
    this.highlight();
  }

  confirm() {
    if (this.selected === 0) {
      this.startGame();
    } else if (this.selected === DIFFICULTY_ROW) {
      this.cycleDifficulty(1);
    } else {
      // `next` must be passed explicitly: Phaser keeps the previous settings.data
      // when scene.start is called without any, so omitting it here would leave a
      // stale 'IntroScene' from the Start gate and send the player into the game.
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
    // Always teach the controls first: they differ by difficulty (Easy auto-runs),
    // so a remembered "already seen" would go stale when the player switches.
    this.scene.start('HowToPlayScene', { next: 'IntroScene' });
  }
}
