import Phaser from 'phaser';
import {
  TRAIL_STAMP_MS,
  TRAIL_LIFE_MS,
  TRAIL_DEPTH_OFFSET,
} from '../config/gameConfig.js';
import { trailAlpha, trailColor } from '../trails.js';

// Afterimage trails for the `trails` section effect (see GameScene). Each stamp
// round copies every source image into a pooled tinted image that then slides
// with the world, fading out over TRAIL_LIFE_MS. Purely visual.
export class Afterimages {
  constructor(scene) {
    this.scene = scene;
    this.live = [];  // { image, age }
    this.free = [];  // hidden images ready for reuse
    this.stampMs = 0;
    this.round = 0;
  }

  // `sources` are Phaser Images; anything else (the placeholder rectangles) is skipped.
  // driftPx is how far the stamps slide left this frame.
  update(delta, active, sources, driftPx) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const stamp = this.live[i];
      stamp.age += delta;
      if (stamp.age >= TRAIL_LIFE_MS) {
        stamp.image.setVisible(false);
        this.free.push(stamp.image);
        this.live.splice(i, 1);
        continue;
      }
      stamp.image.x -= driftPx;
      stamp.image.setAlpha(trailAlpha(stamp.age));
    }

    if (!active) {
      this.stampMs = 0;
      return;
    }
    this.stampMs += delta;
    if (this.stampMs < TRAIL_STAMP_MS) return;
    // Carry the remainder, but never stamp more than one round per frame
    this.stampMs %= TRAIL_STAMP_MS;
    const color = trailColor(this.round++);
    for (const source of sources) {
      if (!(source instanceof Phaser.GameObjects.Image)) continue;
      const image = this.free.pop() ?? this.scene.add.image(0, 0, source.texture.key);
      image
        .setTexture(source.texture.key, source.frame.name)
        .setPosition(source.x, source.y)
        .setOrigin(source.originX, source.originY)
        .setScale(source.scaleX, source.scaleY)
        .setDepth(source.depth - TRAIL_DEPTH_OFFSET)
        .setTintFill(color)
        .setAlpha(trailAlpha(0))
        .setVisible(true);
      this.live.push({ image, age: 0 });
    }
  }

  destroy() {
    this.live.forEach(stamp => stamp.image.destroy());
    this.free.forEach(image => image.destroy());
  }
}
