// Tick sequence of HowToPlayScene's mobile phone mock (one 350ms clock). Pure, so
// it stays testable in plain Node.
// Normal/Hard: six alternating taps, one swipe, one rest tick while it finishes.
// Easy (autoRun): the player never taps, so the loop is just swipe + two rest
// ticks — the swipe animation outlasts a single tick.
export function mobileDemoAction(step, autoRun) {
  if (autoRun) return step % 3 === 0 ? 'swipe' : 'rest';
  const s = step % 8;
  if (s < 6) return s % 2 === 0 ? 'tapLeft' : 'tapRight';
  return s === 6 ? 'swipe' : 'rest';
}
