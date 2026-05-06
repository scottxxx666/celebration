import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load sprites and audio here when assets are ready:
    // this.load.image('player', 'assets/player.png');
    // this.load.image('obstacle', 'assets/obstacle.png');
    // this.load.image('bg', 'assets/background.png');
    // this.load.audio('bgm', 'assets/bgm.mp3');
  }

  create() {
    this.scene.start('GameScene');
  }
}
