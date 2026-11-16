
Art and images (continuity)

- Stage transitions are the weak point for visual continuity. You have mixed styles: procedural (suburb, underground, bikes), AI-restyled (desert, concert, station) and placeholders that reuse existing themes. Pick one shared constraint and apply it to every stage:
    - a common palette or outline weight
    - a shared grade/LUT, which you could do cheaply with a per-theme tint or a global color-grade overlay
    - consistent horizon height and lamp/prop scale
- Replace the placeholder stages before polishing the others. A reused theme in the middle of a custom-art run reads as unfinished more than any single flaw does.
- Keep one recurring motif across stages, such as the same lamp post, a poster or a graffiti mark that changes style with each theme. This ties the AI-restyled and procedural art together.
- Character sprites vs backdrops. If the runner, chaser and obstacle characters come from one art pipeline and the backdrops from another, a shared rim light or shadow color (you already have drop shadows) will make them sit in the scene.
- Station building to underground. Check that the doorway's near-black stairwell matches the underground's first visible frame, so the flash-cut reads as entering that place. A single lit stair or a color echo would be enough.
- Crowd and bikes. Both are good "life" layers. Give the crowd at least 2–3 silhouette variants (hats, raised arms) so it doesn't read as a tiled loop. It currently has only two frames.

Game UX

- Onboarding and feedback
    - The how-to screen is shown on every Start. Add a "hold to skip after the first time" path so retries don't feel gated (Restart already bypasses it).
    - Add a short near-miss cue (a tiny slow-mo or flash) and a clear hit cue. Right now death is the only feedback, so players can't tell why they died in dense or dark sections (strobe, lightsOut).
    - Show a thin progress bar for the song (you already track progress %). Players want to see how far to the end.
- Accessibility
    - You have the photosensitivity warning. Add a Reduced effects toggle that disables strobe, rotate, ghost and jitter. It would be separate from difficulty, and it would let more people finish the song.
    - Add colorblind-safe obstacle outlines, since the dark sections lean on color and silhouettes.
- Difficulty
    - Easy currently auto-runs. Consider also a more forgiving hitbox (you already have OBSTACLE_HITBOX_SCALE), so each level changes one clear thing.
    - On Game Over, show where in the song you died (a mini timeline) and let players practice from the last section start. The ?t= machinery already makes this cheap.
- Mobile: put a short "swipe up/down anywhere" hint on the first run only. The how-to demo is good, but players forget it by the time play starts.

Music

- Audio cues layered on the track. Add subtle SFX that land on the beat: a soft tick when you change rows, a light tap thump for each run step, a small chime for a cleared wall. They make play feel like part of the song and also give feedback in lightsOut sections.
- Dynamics
    - Duck the music slightly under the breakwall SFX and the win jingle so the impact isn't buried.
    - Add a short outro or sting on the CLEAR! screen instead of silence after the track ends.
- Stage-aware mix: a low-pass during the underground stage and a bit of reverb in the concert would reinforce the location changes. It's cheap with WebAudio filters, and conductor/stage times already exist.
- Menu music. A quiet loop on the menu, intro and how-to screens would make the game feel complete, but the track is single-play and sync-sensitive, so it must not share the gameplay track's clock.

Suggested order

1. Placeholder-stage replacement and a shared grade across stages (the biggest visual win).
2. Reduced-effects toggle and a song progress bar.
3. Row-change and wall-clear SFX, plus the win sting.

Tell me which area you want to go deeper on. For art continuity, I could screenshot each stage with the ?t= deep-link and compare them side by side. For the first implementation step, I'll put options A/B/C in front of you before I change any
