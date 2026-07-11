import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.audio('music', 'assets/music.m4a');
    this.load.video('intro', 'assets/intro.mp4');
  }

  create() {
    this.scene.start('MenuScene');
  }
}
