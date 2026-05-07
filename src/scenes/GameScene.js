import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { ObstacleSpawner } from '../objects/ObstacleSpawner.js';
import { Enemy } from '../objects/Enemy.js';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_X, ENEMY_START_X } from '../config/gameConfig.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Placeholder scrolling background (solid color for now)
    this.bg = this.add.rectangle(0, 0, GAME_WIDTH * 3, GAME_HEIGHT, 0x1a1a2e).setOrigin(0, 0);
    this.bgX = 0;

    this.player = new Player(this, PLAYER_X, GAME_HEIGHT / 2);
    this.spawner = new ObstacleSpawner(this);
    this.enemy = new Enemy(this, ENEMY_START_X, GAME_HEIGHT / 2);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    // Speed readout (debug HUD)
    this.speedText = this.add.text(10, 10, '', { fontSize: '14px', color: '#ffffff' });
  }

  update(time, delta) {
    this.player.update(this.cursors, this.leftKey, this.rightKey, delta);

    // Scroll background
    this.bgX -= this.player.speed * (delta / 1000);
    if (this.bgX <= -GAME_WIDTH) this.bgX += GAME_WIDTH;
    this.bg.setX(this.bgX);

    this.spawner.update(time, this.player.speed, delta);

    this.enemy.trackY(this.player.y);
    this.enemy.update(delta / 1000, this.player.speed);

    // Collision
    if (this.player.overlaps(this.enemy)) {
      this.enemy.destroy();
      this.spawner.destroyAll();
      this.scene.start('GameOverScene', { score: Math.floor(time / 1000) });
      return;
    }

    for (const obs of this.spawner.obstacles) {
      if (this.player.overlaps(obs)) {
        this.enemy.destroy();
        this.spawner.destroyAll();
        this.scene.start('GameOverScene', { score: Math.floor(time / 1000) });
        return;
      }
    }

    this.speedText.setText(`speed: ${Math.floor(this.player.speed)}`);
  }
}
