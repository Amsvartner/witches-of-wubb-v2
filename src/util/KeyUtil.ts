/**
 * Camelot-wheel master-key helpers, ported unchanged from the legacy
 * KeyAdjusterContainer (WOW-007B) so the settings band can drive the same
 * `set_master-key` contract. Keys are Camelot notation ("1A"–"12B"):
 * the wheel position (1–12) plus A (minor) / B (major).
 */

const parse = (masterKey: string): { position: number; letter: string } => ({
  position: Number(masterKey.match(/\d+/g)?.[0] ?? 1),
  letter: masterKey.match(/[A-Z]/g)?.[0] ?? '',
});

/** One step forward on the wheel (legacy rotateKeyForwards). '' stays ''. */
const nextKey = (masterKey: string): string => {
  if (!masterKey) return masterKey;
  const { position, letter } = parse(masterKey);
  if (letter.toLowerCase() === 'a') return `${position}B`;
  return position === 12 ? '1A' : `${position + 1}A`;
};

/** One step backward on the wheel (legacy rotateKeyBackwards). '' stays ''. */
const prevKey = (masterKey: string): string => {
  if (!masterKey) return masterKey;
  const { position, letter } = parse(masterKey);
  if (letter.toLowerCase() === 'b') return `${position}A`;
  return position === 1 ? '12B' : `${position - 1}B`;
};

/** Camelot A = minor, B = major; '' (no key yet) has no quality. */
const keyQuality = (masterKey: string): string => {
  if (!masterKey) return '';
  return parse(masterKey).letter.toLowerCase() === 'a' ? 'MINOR' : 'MAJOR';
};

export const KeyUtil = {
  nextKey,
  prevKey,
  keyQuality,
};
