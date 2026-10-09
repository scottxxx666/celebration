import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObstacleSpawner } from '../src/objects/ObstacleSpawner.js';
import { WAVES } from '../src/config/waves.js';
import { OBSTACLE_SPRITES } from '../src/config/obstacleSprites.js';
import { GAME_WIDTH, OBSTACLE_HITBOX_SCALE } from '../src/config/gameConfig.js';

// Stand-in for Phaser game objects: every setter chains, and each records the
// last x it was given and whether it was destroyed.
function fakeScene() {
  const make = () => {
    const target = { height: 280, destroyed: false };
    const proxy = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (prop === 'setX') return x => { t.x = x; return proxy; };
        if (prop === 'destroy') return () => { t.destroyed = true; };
        return () => proxy;
      },
    });
    return proxy;
  };
  return { add: { ellipse: make, image: make, rectangle: make } };
}

function spawnOne(sprite) {
  const spawner = new ObstacleSpawner(fakeScene());
  spawner._spawn({ row: 1, hw: sprite.hw, sprite });
  return { spawner, obs: spawner.obstacles[0] };
}

test('the hitbox scale shrinks, never widens or removes, the hitbox', () => {
  assert.ok(OBSTACLE_HITBOX_SCALE > 0 && OBSTACLE_HITBOX_SCALE <= 1, `OBSTACLE_HITBOX_SCALE ${OBSTACLE_HITBOX_SCALE}`);
});

test('each obstacle collides on its sprite hw scaled down, keeping the full hw for the art', () => {
  for (const sprite of OBSTACLE_SPRITES) {
    const { obs } = spawnOne(sprite);
    assert.equal(obs.hw, sprite.hw * OBSTACLE_HITBOX_SCALE, sprite.key);
    assert.equal(obs.artHw, sprite.hw, sprite.key);
  }
});

test('the hitbox shrinks around the centre: spawn x and art left edge are unchanged', () => {
  const sprite = OBSTACLE_SPRITES[0];
  const { spawner, obs } = spawnOne(sprite);
  assert.equal(obs.x, GAME_WIDTH + sprite.hw);
  spawner.update(-Infinity, 0, 16, 1);
  assert.equal(obs.rect.x, obs.x - sprite.hw);
});

test('an obstacle is kept until its art, not just its hitbox, has left the screen', () => {
  const sprite = OBSTACLE_SPRITES[0];
  const { spawner, obs } = spawnOne(sprite);
  // Hitbox fully off the left edge, art's right edge still on screen
  obs.x = -(obs.hw + obs.artHw) / 2;
  spawner.update(-Infinity, 0, 16, 1);
  assert.equal(spawner.obstacles.length, 1);
  obs.x = -obs.artHw - 1;
  spawner.update(-Infinity, 0, 16, 1);
  assert.equal(spawner.obstacles.length, 0);
  assert.ok(obs.rect.destroyed);
});

test('the spawner flattens the waves it is given into arrival-sorted pending, defaulting to WAVES', () => {
  const custom = [
    { name: 'b', songTime: 5000, obstacles: [{ row: 0, timeOffset: 1 }] },
    { name: 'a', songTime: 1000, obstacles: [{ row: 2, timeOffset: 0 }, { row: 1, timeOffset: 2 }] },
  ];
  const spawner = new ObstacleSpawner(fakeScene(), custom);
  assert.equal(spawner.pending.length, 3);
  const arrivals = spawner.pending.map(p => p.arrivalMs);
  assert.deepEqual(arrivals, [...arrivals].sort((x, y) => x - y));
  assert.equal(arrivals[0], 1000);

  const total = WAVES.reduce((n, w) => n + w.obstacles.length, 0);
  assert.equal(new ObstacleSpawner(fakeScene()).pending.length, total);
});
