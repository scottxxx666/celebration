import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create() {
    this.started = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'intro');
    // Fill the canvas. The video's real dimensions may not exist until its
    // texture is ready, so (re)apply the fit once the texture arrives too —
    // sizing against a 0-width frame would blow the scale up to Infinity.
    const fit = () => video.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    video.on(Phaser.GameObjects.Events.VIDEO_TEXTURE, fit);
    fit();
    video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.startGame());
    video.play();

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, 'Press SPACE to skip', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-ESC', () => this.startGame());
    this.input.once('pointerup', () => this.startGame());
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
