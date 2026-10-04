// Verifies every live section time (sections.js) and every wave/obstacle time
// (waves.js) sits on a real track beat. Usage: yarn check:beats [--fix]
// --fix snaps off-grid section times (sections.js) and wave times (waves.js)
// in place to the nearest real track beat. Regenerating waves.js with
// tools/gen-waves.py overwrites such edits.
import { readFileSync, writeFileSync } from 'node:fs';
import { SECTIONS } from '../src/config/sections.js';
import { WAVES } from '../src/config/waves.js';
import { snapToTrackBeat, trackBeatOf } from '../src/Conductor.js';

const TOLERANCE_MS = 1;
// songTime and timeOffset are each rounded to integer ms, so errors can stack to ~1 ms.
const WAVE_TOLERANCE_MS = 1.5;
const FIELDS = ['startMs', 'endMs'];
const SOURCE = new URL('../src/config/sections.js', import.meta.url);
const WAVES_SOURCE = new URL('../src/config/waves.js', import.meta.url);
const fix = process.argv.includes('--fix');

function beatTag(ms) {
  const beat = trackBeatOf(ms);
  let tag = `beat ${beat}`;
  if (beat % 4 === 0) tag += ', bar start';
  if (beat % 8 === 4) tag += ', phrase start';
  return { beat, tag };
}

const changes = [];
for (const section of SECTIONS) {
  for (const field of FIELDS) {
    const ms = section[field];
    const target = snapToTrackBeat(ms);
    const label = `${section.name}.${field}`;
    if (Math.abs(target - ms) > TOLERANCE_MS) {
      const snapped = Math.round(target);
      const { tag } = beatTag(snapped);
      console.log(`✗ ${label} ${ms} → ${snapped} (${tag}, moved ${snapped - ms} ms)`);
      changes.push({ name: section.name, field, from: ms, to: snapped });
    } else {
      console.log(`✓ ${label} ${ms} (${beatTag(ms).tag})`);
    }
  }
}

if (!changes.length) {
  console.log('All section times are on a real track beat.');
} else if (!fix) {
  console.log(`\n${changes.length} off-grid section time(s). Run \`yarn fix:beats\` to rewrite them.`);
}

let waveTimes = 0;
let waveFailures = 0;
const waveChanges = [];
function checkWaveTime(label, ms, to) {
  waveTimes++;
  const target = snapToTrackBeat(ms);
  if (Math.abs(target - ms) <= WAVE_TOLERANCE_MS) return;
  waveFailures++;
  const arrow = fix ? ` → ${to}` : '';
  console.log(`✗ ${label} ${ms}${arrow} (nearest beat ${trackBeatOf(ms)}, off ${(ms - target).toFixed(1)} ms)`);
}
console.log('');
for (const wave of WAVES) {
  const songTime = wave.songTime;
  const songOff = Math.abs(snapToTrackBeat(songTime) - songTime) > WAVE_TOLERANCE_MS;
  const newSongTime = songOff ? Math.round(snapToTrackBeat(songTime)) : songTime;
  if (newSongTime !== songTime) waveChanges.push({ name: wave.name, kind: 'songTime', from: songTime, to: newSongTime });
  checkWaveTime(`waves.${wave.name}.songTime`, songTime, newSongTime);
  wave.obstacles.forEach((o, i) => {
    const abs = songTime + o.timeOffset;
    const off = Math.abs(snapToTrackBeat(abs) - abs) > WAVE_TOLERANCE_MS;
    const to = Math.round(snapToTrackBeat(abs)) - newSongTime;
    if ((off || newSongTime !== songTime) && to !== o.timeOffset) {
      waveChanges.push({ name: wave.name, kind: 'timeOffset', index: i, from: o.timeOffset, to });
    }
    checkWaveTime(`waves.${wave.name}.obstacles[${i}]`, abs, newSongTime + to);
  });
}
if (!waveFailures) {
  console.log(`✓ waves: ${waveTimes} times on a real track beat`);
} else if (!fix) {
  console.log(`\n${waveFailures} off-grid wave time(s). Run \`yarn fix:beats\` to snap them in place.`);
  console.log('Regenerating with `uv run --with librosa --with numpy python tools/gen-waves.py` overwrites hand edits.');
}

function fail(msg) {
  console.error(`${msg}; nothing written.`);
  process.exit(1);
}

function rewriteSections() {
  const lines = readFileSync(SOURCE, 'utf8').split('\n');
  const live = lines.map((line, i) => ({ line, i })).filter(({ line }) => !line.trim().startsWith('//'));
  for (const name of new Set(changes.map(c => c.name))) {
    const matches = live.filter(({ line }) => line.includes(`name: '${name}'`));
    if (matches.length !== 1) fail(`Cannot find a unique live line for section '${name}' (${matches.length} found)`);
    const target = matches[0];
    for (const c of changes.filter(c => c.name === name)) {
      const re = new RegExp(`(${c.field}:\\s*)\\d+(\\.\\d+)?`);
      if (!re.test(target.line)) fail(`Cannot find ${c.field} on the line for '${name}'`);
      target.line = target.line.replace(re, `$1${c.to}`);
    }
    lines[target.i] = target.line;
  }
  writeFileSync(SOURCE, lines.join('\n'));
  console.log(`\nRewrote ${changes.length} section value(s):`);
  for (const c of changes) console.log(`  ${c.name}.${c.field} ${c.from} → ${c.to}`);
}

function rewriteWaves() {
  const lines = readFileSync(WAVES_SOURCE, 'utf8').split('\n');
  const isLive = i => !lines[i].trim().startsWith('//');
  const nameIdx = name => {
    const hits = lines.map((_, i) => i).filter(i => isLive(i) && lines[i].includes(`name: '${name}'`));
    if (hits.length !== 1) fail(`Cannot find a unique live line for wave '${name}' (${hits.length} found)`);
    return hits[0];
  };
  const replaceNum = (i, key, to, what) => {
    const re = new RegExp(`(${key}:\\s*)-?\\d+(\\.\\d+)?`);
    if (!re.test(lines[i])) fail(`Cannot find ${key} on line ${i + 1} for ${what}`);
    lines[i] = lines[i].replace(re, `$1${to}`);
  };
  for (const name of new Set(waveChanges.map(c => c.name))) {
    const n = nameIdx(name);
    let end = n + 1;
    while (end < lines.length && !(isLive(end) && lines[end].includes("name: '"))) end++;
    const offsets = [];
    for (let i = n + 1; i < end; i++) if (isLive(i) && lines[i].includes('timeOffset:')) offsets.push(i);
    for (const c of waveChanges.filter(c => c.name === name)) {
      if (c.kind === 'songTime') {
        let s = n;
        while (s >= 0 && !(isLive(s) && lines[s].includes('songTime:'))) s--;
        if (s < 0) fail(`Cannot find songTime line for wave '${name}'`);
        replaceNum(s, 'songTime', c.to, `wave '${name}'`);
      } else {
        if (offsets[c.index] === undefined) fail(`Cannot find obstacle ${c.index} of wave '${name}'`);
        replaceNum(offsets[c.index], 'timeOffset', c.to, `wave '${name}' obstacle ${c.index}`);
      }
    }
  }
  writeFileSync(WAVES_SOURCE, lines.join('\n'));
  console.log(`\nRewrote ${waveChanges.length} wave value(s):`);
  for (const c of waveChanges) {
    console.log(`  ${c.name}.${c.kind === 'songTime' ? 'songTime' : `obstacles[${c.index}].timeOffset`} ${c.from} → ${c.to}`);
  }
}

if (fix) {
  try {
    if (changes.length) rewriteSections();
    if (waveChanges.length) rewriteWaves();
  } catch (err) {
    console.error(`Write failed: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}
process.exit(waveFailures || changes.length ? 1 : 0);
