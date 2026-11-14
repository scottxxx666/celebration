// Which of the two crowd frames (0 | 1) shows at `beatTimeMs` (conductor.beatTimeMs, may be negative):
// the beat grid is cut into 1/swapsPerBeat-beat slots and the frame alternates every slot. Stateless
// (floor/mod, so negative times keep the alternation and `?t=` seeks just work); swapsPerBeat <= 0
// pins frame 0.
export function crowdFrame(beatTimeMs, beatMs, swapsPerBeat) {
  if (!(swapsPerBeat > 0)) return 0;
  const slot = Math.floor((beatTimeMs * swapsPerBeat) / beatMs);
  return ((slot % 2) + 2) % 2;
}
