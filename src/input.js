import Phaser from 'phaser';

// Scene-level pointer listeners removed again on SHUTDOWN. `up` also handles
// POINTER_UP_OUTSIDE (release off-canvas), the case every consumer wants.
export function bindPointer(scene, { down, move, up }) {
  const E = Phaser.Input.Events;
  const bindings = [
    [E.POINTER_DOWN, down],
    [E.POINTER_MOVE, move],
    [E.POINTER_UP, up],
    [E.POINTER_UP_OUTSIDE, up],
  ].filter(([, fn]) => fn);
  bindings.forEach(([event, fn]) => scene.input.on(event, fn));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    bindings.forEach(([event, fn]) => scene.input.off(event, fn));
  });
}

// "Any input moves on" for the transient scenes (intro, how-to-play, game over).
// Two guards, both because the input that reached this scene must not also
// spend it: keys ignore auto-repeat (SPACE still held from the previous
// scene's confirm), and a tap needs a fresh press *then* release — a finger
// still held from the death tap would otherwise fire pointerup here, and a
// volume-slider drag released off its zone would arm nothing (the slider
// stopPropagates its own pointerdown) instead of skipping.
// `keys` maps key names ('SPACE', 'ESC', 'ENTER') to handlers.
export function onDismiss(scene, { keys = {}, tap }) {
  for (const [key, fn] of Object.entries(keys)) {
    scene.input.keyboard.on(`keydown-${key}`, (event) => {
      if (!event.repeat) fn();
    });
  }
  if (tap) {
    scene.input.once('pointerdown', () => {
      scene.input.once('pointerup', tap);
    });
  }
}

// Arrow keys plus their WASD aliases, one array of keys per direction.
const DIRECTION_KEYS = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
};

export function addDirectionKeys(scene) {
  const keys = {};
  for (const [dir, names] of Object.entries(DIRECTION_KEYS)) {
    keys[dir] = names.map((name) => scene.input.keyboard.addKey(name));
  }
  return keys;
}

// JustDown on every alias (not short-circuited): JustDown clears the key's
// flag, so a skipped alias pressed the same frame would fire again next frame.
export function anyJustDown(keys) {
  return keys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
}

// Event-style binding for menus: `dir` fires on any alias's keydown.
export function onDirectionKey(scene, dir, fn) {
  for (const name of DIRECTION_KEYS[dir]) scene.input.keyboard.on(`keydown-${name}`, fn);
}
