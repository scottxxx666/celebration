import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseDecay, groupPulse, beatPulse } from '../src/beatPulse.js';
import { PULSE_GROUPS, PULSE_GLOW_STRENGTH, PULSE_LIFT_STRENGTH } from '../src/config/gameConfig.js';

const BEAT = 400;
const byName = name => PULSE_GROUPS.find(g => g.name === name);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test('pulseDecay: 1 at start, 0 at and past the end, monotone, quadratic ease-out', () => {
  assert.equal(pulseDecay(0, 1), 1);
  assert.equal(pulseDecay(1, 1), 0);
  assert.equal(pulseDecay(2, 1), 0);
  near(pulseDecay(0.5, 1), 0.25);
  assert.ok(pulseDecay(0.2, 1) > pulseDecay(0.4, 1));
  assert.equal(pulseDecay(-0.1, 1), 0);
  assert.equal(pulseDecay(0.1, 0), 0);
});

test('groups alternate on even/odd beats', () => {
  const a = { divisions: 1, every: 2, offset: 0, decay: 1 };
  const b = { divisions: 1, every: 2, offset: 1, decay: 1 };
  assert.equal(groupPulse(0, BEAT, a), 1);
  assert.equal(groupPulse(0, BEAT, b), 0);
  assert.equal(groupPulse(BEAT, BEAT, a), 0);
  assert.equal(groupPulse(BEAT, BEAT, b), 1);
  assert.equal(groupPulse(2 * BEAT, BEAT, a), 1);
});

test('a pulse decays over its slot and is continuous into the group\'s dark slot', () => {
  const a = { divisions: 1, every: 2, offset: 0, decay: 1 };
  const mid = groupPulse(BEAT * 0.5, BEAT, a);
  assert.ok(mid > 0 && mid < 1);
  assert.ok(groupPulse(BEAT * 0.999, BEAT, a) < 0.01);
  assert.equal(groupPulse(BEAT * 1.5, BEAT, a), 0);
});

test('phase wraps: the same phase one cycle later gives the same level', () => {
  const g = byName('magenta');
  near(groupPulse(130, BEAT, g), groupPulse(130 + 2 * BEAT, BEAT, g));
  near(groupPulse(130, BEAT, g), groupPulse(130 + 10 * BEAT, BEAT, g));
});

test('negative song time keeps the alternation (beat -1 is odd)', () => {
  const a = { divisions: 1, every: 2, offset: 0, decay: 1 };
  const b = { divisions: 1, every: 2, offset: 1, decay: 1 };
  assert.equal(groupPulse(-BEAT, BEAT, a), 0);
  assert.equal(groupPulse(-BEAT, BEAT, b), 1);
  assert.equal(groupPulse(-2 * BEAT, BEAT, a), 1);
  const p = beatPulse(-BEAT + 1, BEAT);
  assert.ok(p.lift >= 0 && p.lift <= PULSE_LIFT_STRENGTH);
  assert.ok(p.groups.cyan > 0.99 * PULSE_GLOW_STRENGTH);
});

test('half-beat group fires twice per beat', () => {
  const wall = byName('wall');
  assert.equal(groupPulse(0, BEAT, wall), 1);
  assert.equal(groupPulse(BEAT / 2, BEAT, wall), 1);
  assert.ok(groupPulse(BEAT / 4, BEAT, wall) < 1);
});

test('beatPulse: peak equals strength, groups never exceed it', () => {
  const p = beatPulse(0, BEAT);
  near(p.groups.magenta, PULSE_GLOW_STRENGTH);
  assert.equal(p.groups.cyan, 0);
  near(p.lift, PULSE_LIFT_STRENGTH);
  for (let t = -800; t < 3000; t += 7) {
    const q = beatPulse(t, BEAT);
    for (const v of Object.values(q.groups)) assert.ok(v >= 0 && v <= PULSE_GLOW_STRENGTH);
    assert.ok(q.lift >= 0 && q.lift <= PULSE_LIFT_STRENGTH);
  }
});

test('strength 0 turns each layer off independently', () => {
  const noGlow = beatPulse(0, BEAT, { glowStrength: 0 });
  assert.ok(Object.values(noGlow.groups).every(v => v === 0));
  assert.ok(noGlow.lift > 0);
  const noLift = beatPulse(0, BEAT, { liftStrength: 0 });
  assert.equal(noLift.lift, 0);
  assert.ok(noLift.groups.magenta > 0);
});

test('lift decays within the beat and is 0 after liftDecayBeats', () => {
  const early = beatPulse(BEAT * 0.1, BEAT, { liftDecayBeats: 0.5 }).lift;
  const late = beatPulse(BEAT * 0.4, BEAT, { liftDecayBeats: 0.5 }).lift;
  assert.ok(early > late && late > 0);
  assert.equal(beatPulse(BEAT * 0.6, BEAT, { liftDecayBeats: 0.5 }).lift, 0);
});

test('every configured group name has a matching theme glow file', async () => {
  const { SCENERY_THEMES } = await import('../src/config/sceneryThemes.js');
  const names = SCENERY_THEMES.concert.pulse.map(g => g.group).sort();
  assert.deepEqual(names, PULSE_GROUPS.map(g => g.name).sort());
});
