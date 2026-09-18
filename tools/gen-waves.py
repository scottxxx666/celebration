#!/usr/bin/env python3
"""Generate src/config/waves.js from the track's onsets.

    uv run --quiet --with librosa --with numpy python tools/gen-waves.py
    uv run --quiet --with librosa --with numpy python tools/gen-waves.py \\
        --music public/assets/music.m4a --out src/config/waves.js

Track facts (measured 2026-09-18, treat as fact — see CLAUDE.md):
  public/assets/music.m4a, 139.52s, constant tempo 150.55 BPM.
  beat length = 60000 / 150.55 ≈ 398.54 ms.
  real beat n happens at song time `549 + n * 398.54` ms (beat 0 = 549ms is the
  first downbeat). Every musical phrase boundary falls on a real beat ≡ 4 (mod 8).

The song is divided into sections (in real beats) each with an authored obstacle
density "profile" (sparse/light/normal/dense/none). For each section this script:
  1. decodes the track and computes onset-strength envelopes (full band, kick band
     <150Hz, snare/hat band 2000-8000Hz),
  2. samples those envelopes at every real beat in the section,
  3. greedily picks obstacle beats per the profile's minGap/fill parameters,
  4. assigns each obstacle a row (0=back/top .. 4=front/bottom) from the
     kick/snare balance at that beat, alternating within a row-group and never
     repeating the immediately preceding obstacle's row,
  5. sizes each obstacle from its section-relative strength quartile,
  6. (dense sections only) emits top+bottom obstacle PAIRS on phrase downbeats,
  7. and (wall sections only) emits a four-obstacle WALL with one gap row on
     every game beat (every 2 real beats), the gap stepping exactly ±1 row per
     wall so the player must move exactly one row per beat.

Writes src/config/waves.js as an ES module. NEVER hand-edit that file — regenerate
it with this script instead.

Needs ffmpeg on PATH and librosa+numpy (run via `uv run --with librosa --with numpy`).
"""
import argparse
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
import librosa

TRACK_BPM = 150.55
BEAT_MS = 60000 / TRACK_BPM  # ~398.54
FIRST_BEAT_MS = 549  # real beat 0 (first downbeat)

HOP = 128
SR = 22050

# name, startBeat, endBeat, profile
SECTIONS = [
    ('intro',     0,   36,  'sparse'),
    ('chorus1a',  36,  64,  'normal'),
    ('drop',      64,  68,  'none'),
    ('chorus1b',  68,  132, 'normal'),
    ('verse2',    132, 164, 'light'),
    ('chorus2',   164, 196, 'wall'),
    ('post2',     196, 228, 'light'),
    ('bridgeA',   228, 244, 'normal'),
    ('bridgeB',   244, 308, 'light'),
    ('chorus3',   308, 340, 'wall'),
    ('outro',     340, 350, 'none'),
]

PROFILES = {
    'sparse': dict(minGap=8, fill=1.0, startMargin=8),
    'light':  dict(minGap=4, fill=0.6, startMargin=0),
    'normal': dict(minGap=2, fill=0.7, startMargin=0),
    'dense':  dict(minGap=2, fill=0.85, startMargin=0),
    # 'wall': gap-wall profile — every game beat (2 real beats) blocks all rows
    # except one gap row, and the gap steps ±1 row per wall. Handled entirely
    # by its own branch in build_waves (never calls pick_obstacles); minGap=2
    # only documents the game-beat cadence between walls.
    'wall':   dict(minGap=2),
    'none':   None,
}


def beat_ms(n):
    return FIRST_BEAT_MS + n * BEAT_MS


def decode_to_wav(music_path, wav_path):
    subprocess.run(
        ['ffmpeg', '-y', '-i', music_path, '-ac', '1', '-ar', str(SR), wav_path],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def band_envelope(y, sr, hop, fmin, fmax):
    S = np.abs(librosa.stft(y, hop_length=hop))
    f = librosa.fft_frequencies(sr=sr)
    mask = (f >= fmin) & (f < fmax) if fmax is not None else (f >= fmin)
    band = S[mask]
    return librosa.onset.onset_strength(
        S=librosa.power_to_db(band ** 2), sr=sr, hop_length=hop)


def normalize(env):
    p99 = np.percentile(env, 99)
    if p99 <= 0:
        return env
    return env / p99


def sample_at(env, times, t_ms, window_ms=40):
    t = t_ms / 1000.0
    w = window_ms / 1000.0
    mask = (times >= t - w) & (times <= t + w)
    if not np.any(mask):
        idx = np.argmin(np.abs(times - t))
        return float(env[idx])
    return float(np.max(env[mask]))


def pick_obstacles(section, beats_info, prev_section_last_beat):
    """beats_info: list of (beat_n, strength, kick, snare) for candidate beats."""
    name, start, end, profile_name = section
    profile = PROFILES[profile_name]
    if profile is None:
        return []

    min_gap = profile['minGap']
    fill = profile['fill']
    start_margin = profile.get('startMargin', 0)
    cand_start = start + start_margin

    candidates = [b for b in beats_info if cand_start <= b[0] < end]
    # sort by strength desc, tie-break beat index asc
    candidates_sorted = sorted(candidates, key=lambda b: (-b[1], b[0]))

    target_count = math.floor(fill * (end - start) / min_gap)

    accepted = []
    for cand in candidates_sorted:
        if len(accepted) >= target_count:
            break
        n = cand[0]
        ok = True
        if prev_section_last_beat is not None and (n - prev_section_last_beat) < 2:
            ok = False
        for a in accepted:
            if abs(n - a[0]) < min_gap:
                ok = False
                break
        if ok:
            accepted.append(cand)

    accepted.sort(key=lambda b: b[0])
    return accepted


def assign_rows_and_sizes(section_name, profile_name, accepted, strengths_in_section, prev_row_state):
    """prev_row_state: mutable dict with key 'prev_rows' = set of rows used by the
    immediately preceding obstacle (single obstacle -> one row, pair -> {0,4})."""
    obstacles = []  # list of dicts: beat_n, row, hw, visualHh (order given)

    # Size and row-group thresholds are ranked among THIS section's picked singles
    # (not all beats): picks are by construction the strongest beats, so fixed
    # thresholds would make everything wide and push every row into one group.
    singles = [it for it in accepted if not it[4]]
    picked_strengths = [it[1] for it in singles]
    picked_ratios = [it[2] / (it[2] + it[3] + 1e-6) for it in singles]
    if picked_strengths:
        q1, q2, q3 = np.percentile(picked_strengths, [25, 50, 75])
        r_lo, r_hi = np.percentile(picked_ratios, [33.3, 66.7])
    else:
        q1 = q2 = q3 = 0
        r_lo = r_hi = 0.5

    def hw_for(strength):
        if strength <= q1:
            return 20
        if strength <= q2:
            return 25
        if strength <= q3:
            return 30
        return 40

    def visual_hh_for(group):
        return {'low': 20, 'mid': 30, 'high': 50}[group]

    # dense: identify phrase downbeats inside section for pairs
    is_dense = profile_name == 'dense'
    pair_beats = set()
    if is_dense:
        start_beat = accepted[0][0] if accepted else None
    # We need section bounds; caller passes via closures below instead.

    # first pass (dense only): find phrase downbeats within section range covered by accepted list's context
    # handled by caller; this function just assigns rows/sizes given final beat list w/ pair flags injected via 'is_pair'

    group_alt_state = {'low': 0, 'high': 0}  # index into (row_a, row_b) alternation, per group

    for item in accepted:
        n, strength, kick, snare, is_pair = item
        r = kick / (kick + snare + 1e-6)
        # kick-heavy third -> front rows, snare/hat-heavy third -> back rows
        if r > r_hi:
            group = 'low'
            rows = (3, 4)
        elif r < r_lo:
            group = 'high'
            rows = (0, 1)
        else:
            group = 'mid'
            rows = (2, 2)

        if is_pair:
            row_list = [0, 4]
            hw = 30
            vhh = 54
            for row in row_list:
                obstacles.append({'beat': n, 'row': row, 'hw': hw, 'visualHh': vhh})
            prev_row_state['prev_rows'] = {0, 4}
            continue

        if group == 'mid':
            row = 2
        else:
            idx = group_alt_state[group] % 2
            row = rows[idx]
            group_alt_state[group] += 1

        # never share row of immediately previous obstacle
        prev_rows = prev_row_state.get('prev_rows')
        if prev_rows and row in prev_rows:
            if group == 'mid':
                row = 1 if 1 not in prev_rows else 3
            else:
                other = rows[1] if row == rows[0] else rows[0]
                row = other
            if row in prev_rows:
                # Coming out of a wall section prev_rows blocks 4 of 5 rows
                # (every row but the last gap row) — the group-based alternate
                # above can't help. Fall back toward the gap row: try its
                # neighbours first, then the gap row itself (always free).
                last_gap_row = prev_row_state.get('last_gap_row')
                if last_gap_row is not None:
                    for cand in (last_gap_row - 1, last_gap_row + 1, last_gap_row):
                        if 0 <= cand <= 4 and cand not in prev_rows:
                            row = cand
                            break

        hw = hw_for(strength)
        vhh = visual_hh_for(group)
        obstacles.append({'beat': n, 'row': row, 'hw': hw, 'visualHh': vhh})
        prev_row_state['prev_rows'] = {row}

    return obstacles


def build_waves(env_full, env_kick, env_snare, times, duration_s):
    prev_row_state = {'prev_rows': None, 'last_gap_row': None}
    waves = []
    total_obstacles = 0
    total_pairs = 0
    total_walls = 0
    prev_section_last_accepted_beat = None

    for section in SECTIONS:
        name, start, end, profile_name = section

        # gather candidate beats info for this section (and a little beyond isn't needed)
        beats_info = []
        n = start
        while beat_ms(n) < duration_s * 1000.0 and n < end:
            t_ms = beat_ms(n)
            full = sample_at(env_full, times, t_ms)
            kick = sample_at(env_kick, times, t_ms)
            snare = sample_at(env_snare, times, t_ms)
            strength = 0.5 * full + 0.3 * kick + 0.2 * snare
            beats_info.append((n, strength, kick, snare))
            n += 1

        if profile_name == 'none' or not beats_info:
            continue

        if profile_name == 'wall':
            info_by_n = {b[0]: b for b in beats_info}
            wall_beats = [
                n for n in range(start, end)
                if (n - start) % 2 == 0 and beat_ms(n) < duration_s * 1000.0 and n in info_by_n
            ]
            if not wall_beats:
                continue

            ratios = {}
            for n in wall_beats:
                _, _strength, kick, snare = info_by_n[n]
                ratios[n] = kick / (kick + snare + 1e-6)
            median_ratio = float(np.median(list(ratios.values())))

            # starting gap row: default middle, unless the previous obstacle
            # (a single) tells us to start adjacent to its row instead.
            prev_rows = prev_row_state.get('prev_rows')
            gap_row = 2
            if prev_rows and len(prev_rows) == 1:
                r = next(iter(prev_rows))
                if r == 2:
                    gap_row = 3 if ratios[wall_beats[0]] >= median_ratio else 1
                else:
                    candidates = [c for c in (r - 1, r + 1) if 0 <= c <= 4]
                    gap_row = min(candidates, key=lambda c: abs(c - 2))

            gap_rows = []
            for i, n in enumerate(wall_beats):
                if i == 0:
                    g = gap_row
                else:
                    prev_g = gap_rows[-1]
                    if prev_g == 0:
                        g = prev_g + 1
                    elif prev_g == 4:
                        g = prev_g - 1
                    elif ratios[n] >= median_ratio:
                        g = prev_g + 1
                    else:
                        g = prev_g - 1
                gap_rows.append(g)

            section_start_ms = beat_ms(start)
            section_end_ms = beat_ms(end)
            obstacles = []
            for n, g in zip(wall_beats, gap_rows):
                t_off = round(beat_ms(n) - section_start_ms)
                for row in range(5):
                    if row == g:
                        continue
                    obstacles.append({'timeOffset': t_off, 'row': row, 'hw': 25, 'visualHh': 54})
            obstacles.sort(key=lambda o: o['timeOffset'])

            waves.append({
                'songTime': round(section_start_ms),
                'name': name,
                'duration': round(section_end_ms - section_start_ms),
                'obstacles': obstacles,
            })

            total_obstacles += len(obstacles)
            total_walls += len(wall_beats)
            print(f'  {name:10s} start={section_start_ms/1000:6.2f}s  '
                  f'obstacles={len(obstacles):3d}  walls={len(wall_beats):3d}')

            last_gap_row = gap_rows[-1]
            prev_row_state['prev_rows'] = set(range(5)) - {last_gap_row}
            prev_row_state['last_gap_row'] = last_gap_row
            prev_section_last_accepted_beat = wall_beats[-1]
            continue

        accepted = pick_obstacles(section, beats_info, prev_section_last_accepted_beat)

        is_dense = profile_name == 'dense'
        final_items = []  # (n, strength, kick, snare, is_pair)
        if is_dense:
            # phrase downbeats within [start, end)
            downbeats = [n for n in range(start, end) if (n - 4) % 8 == 0]
            accepted_by_n = {a[0]: a for a in accepted}
            used_downbeats = set()
            remaining = dict(accepted_by_n)
            for db in downbeats:
                if beat_ms(db) >= duration_s * 1000.0:
                    continue
                # remove any single obstacle picked within 1 beat of this downbeat
                for n in list(remaining.keys()):
                    if abs(n - db) <= 1:
                        del remaining[n]
                # need info for the pair beat itself (may not be in beats_info window
                # if outside start..end-1, but db is within [start,end) by construction)
                info = next((b for b in beats_info if b[0] == db), None)
                if info is None:
                    continue
                final_items.append((db, info[1], info[2], info[3], True))
                used_downbeats.add(db)
                total_pairs += 1
            for n, item in sorted(remaining.items()):
                if n in used_downbeats:
                    continue
                final_items.append((n, item[1], item[2], item[3], False))
            final_items.sort(key=lambda x: x[0])
        else:
            final_items = [(n, s, k, sn, False) for (n, s, k, sn) in accepted]

        if not final_items:
            continue

        strengths_in_section = [b[1] for b in beats_info]
        obstacles_raw = assign_rows_and_sizes(
            name, profile_name, final_items, strengths_in_section, prev_row_state)

        section_start_ms = beat_ms(start)
        section_end_ms = beat_ms(end)
        song_time = round(section_start_ms)
        wave_duration = round(section_end_ms - section_start_ms)

        obstacles = []
        for o in obstacles_raw:
            time_offset = round(beat_ms(o['beat']) - section_start_ms)
            obstacles.append({
                'timeOffset': time_offset,
                'row': o['row'],
                'hw': o['hw'],
                'visualHh': o['visualHh'],
            })
        obstacles.sort(key=lambda o: o['timeOffset'])

        waves.append({
            'songTime': song_time,
            'name': name,
            'duration': wave_duration,
            'obstacles': obstacles,
        })

        n_single = sum(1 for it in final_items if not it[4])
        n_pairs = sum(1 for it in final_items if it[4])
        total_obstacles += len(obstacles)
        print(f'  {name:10s} start={section_start_ms/1000:6.2f}s  '
              f'obstacles={len(obstacles):3d}  singles={n_single:3d}  pairs={n_pairs:2d}')

        if final_items:
            prev_section_last_accepted_beat = final_items[-1][0]

    return waves, total_obstacles, total_pairs, total_walls


def render_js(waves):
    lines = []
    lines.append('// GENERATED by tools/gen-waves.py — do not hand-edit; regenerate instead.')
    lines.append('//')
    lines.append('// Track: public/assets/music.m4a, 150.55 BPM constant tempo, beat length')
    lines.append('// = 60000/150.55 ≈ 398.54 ms. Real beat 0 (first downbeat) is at 549 ms,')
    lines.append('// so real beat n happens at song time `549 + n * 398.54` ms. Section table')
    lines.append('// and density profiles live in tools/gen-waves.py.')
    lines.append('//')
    lines.append('// wall sections: 4 obstacles per beat with one gap row; the gap moves ±1 row')
    lines.append('// per wall so the player steps rows on the beat.')
    lines.append('//')
    lines.append('// row: player row index the obstacle occupies, 0 (top/back) – 4 (bottom/front).')
    lines.append('// hw: collision half-width (AABB) — matches ObstacleSpawner collision.')
    lines.append('// visualHh: drawn half-height only; never affects collision (always blocks exactly 1 row).')
    lines.append('// timeOffset: ms after wave start; events must be sorted ascending.')
    lines.append('')
    lines.append('export const WAVES = [')
    for w in waves:
        lines.append('  {')
        lines.append(f"    songTime: {w['songTime']},")
        lines.append(f"    name: '{w['name']}',")
        lines.append(f"    duration: {w['duration']},")
        lines.append('    obstacles: [')
        for o in w['obstacles']:
            lines.append(
                f"      {{ timeOffset: {o['timeOffset']}, row: {o['row']}, hw: {o['hw']}, visualHh: {o['visualHh']} }},")
        lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    return '\n'.join(lines)


def sanity_check(waves, wall_section_names):
    all_events = []
    for w in waves:
        for o in w['obstacles']:
            all_events.append(w['songTime'] + o['timeOffset'])
    distinct = sorted(set(all_events))
    assert distinct, 'no obstacles generated at all'
    assert distinct[0] >= 3000, f'first obstacle at {distinct[0]}ms, expected >= 3000ms'
    min_gap_beat_ms = 2 * BEAT_MS  # ~797ms
    for a, b in zip(distinct, distinct[1:]):
        assert (b - a) >= min_gap_beat_ms - 1, (
            f'gap {b - a}ms between {a}ms and {b}ms is below the {min_gap_beat_ms:.1f}ms minimum')

    for w in waves:
        if w['name'] not in wall_section_names:
            continue
        by_t = {}
        for o in w['obstacles']:
            by_t.setdefault(o['timeOffset'], []).append(o['row'])
        gap_rows = []
        for t in sorted(by_t):
            rows = by_t[t]
            assert len(rows) == 4 and len(set(rows)) == 4, (
                f"wall {w['name']} at {t}ms has rows {rows}, expected 4 distinct rows")
            gap = [r for r in range(5) if r not in rows][0]
            gap_rows.append(gap)
        for a, b in zip(gap_rows, gap_rows[1:]):
            assert abs(b - a) == 1, (
                f"wall {w['name']} gap row jumped from {a} to {b}, expected a step of exactly 1")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--music', default='public/assets/music.m4a', help='input track')
    ap.add_argument('--out', default='src/config/waves.js', help='output waves.js path')
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, 'track.wav')
        print(f'decoding {args.music} -> {wav_path}')
        decode_to_wav(args.music, wav_path)

        y, sr = librosa.load(wav_path, sr=SR, mono=True)
        duration_s = len(y) / sr
        print(f'loaded: {duration_s:.2f}s @ {sr}Hz')

        env_full = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
        env_kick = band_envelope(y, sr, HOP, 0, 150)
        env_snare = band_envelope(y, sr, HOP, 2000, 8000)

        n_frames = min(len(env_full), len(env_kick), len(env_snare))
        env_full = normalize(env_full[:n_frames])
        env_kick = normalize(env_kick[:n_frames])
        env_snare = normalize(env_snare[:n_frames])
        times = librosa.frames_to_time(np.arange(n_frames), sr=sr, hop_length=HOP)

    print('per-section summary:')
    waves, total_obstacles, total_pairs, total_walls = build_waves(
        env_full, env_kick, env_snare, times, duration_s)

    wall_section_names = {s[0] for s in SECTIONS if s[3] == 'wall'}
    sanity_check(waves, wall_section_names)

    js = render_js(waves)
    with open(args.out, 'w') as f:
        f.write(js)

    print(f'wrote {args.out}')
    print(f'total: {len(waves)} waves, {total_obstacles} obstacles, {total_pairs} pairs, {total_walls} walls')


if __name__ == '__main__':
    main()
