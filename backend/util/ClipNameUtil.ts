function normalizeClipName(clipName: string): string {
  // \s (not just ' ') so the helper stays a strict superset of the .trim()
  // it replaced at the Live-set lookup sites: names carrying pasted tabs,
  // non-breaking spaces, or a BOM at the edges matched under trim and must
  // keep matching here (audio-ableton-reviewer re-sign-off, Required item).
  return clipName.replace(/[*\s]/g, '');
}

export const ClipNameUtil = {
  normalizeClipName,
};
