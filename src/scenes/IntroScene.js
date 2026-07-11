import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create() {
    this.started = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'intro');
    // Fill the canvas. The object starts as a 256x256 placeholder, and
    // VIDEO_TEXTURE fires *before* Phaser adopts the real frame size — so
    // setDisplaySize here would bake in a 256-based scale that zoom-crops the
    // video once the real frame lands. Set scale from the texture's own
    // dimensions instead; Phaser preserves scale (not display size) through
    // the frame swap.
    video.once(Phaser.GameObjects.Events.VIDEO_TEXTURE, (_vid, texture) => {
      const frame = texture.get();
      video.setScale(GAME_WIDTH / frame.realWidth, GAME_HEIGHT / frame.realHeight);
    });
    video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.startGame());
    video.play();

    const isDesktop = this.sys.game.device.os.desktop;
    const skipHint = isDesktop ? 'Press SPACE to skip' : 'Tap to skip';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, skipHint, {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-ESC', () => this.startGame());
    this.input.once('pointerup', () => this.startGame());

    addFullscreenButton(this);
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    const go = () => this.scene.start('GameScene');
    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, go);
    } else {
      go();
    }
  }
}
