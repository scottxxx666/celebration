import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { HowToPlayScene } from './scenes/HowToPlayScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from './config/gameConfig.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d0d1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, MenuScene, HowToPlayScene, IntroScene, GameScene, GameOverScene],
});

// F toggles fullscreen in any scene on desktop; Phaser keyboard input is
// per-scene, so a single DOM listener avoids re-binding in every scene.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && game.device.os.desktop) {
    game.scale.toggleFullscreen();
  }
});
