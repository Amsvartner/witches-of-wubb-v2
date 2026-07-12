function normalizeClipName(clipName: string): string {
  return clipName.replace(/[* ]/g, '');
}

export const ClipNameUtil = {
  normalizeClipName,
};
