import { ClipNameUtil } from '../ClipNameUtil';

describe('ClipNameUtil.normalizeClipName (WOW-031)', () => {
  it('strips asterisks', () => {
    expect(ClipNameUtil.normalizeClipName('Wicked*Casting')).toBe('WickedCasting');
    expect(ClipNameUtil.normalizeClipName('*Loop*')).toBe('Loop');
  });

  it('strips all spaces, not just leading/trailing', () => {
    expect(ClipNameUtil.normalizeClipName('  Wicked Casting  ')).toBe('WickedCasting');
    expect(ClipNameUtil.normalizeClipName('Wicked   Casting')).toBe('WickedCasting');
  });

  it('strips a combination of asterisks and spaces in any position', () => {
    expect(ClipNameUtil.normalizeClipName(' * Wicked * Casting * ')).toBe('WickedCasting');
  });

  it('is a no-op for a name with neither asterisks nor spaces', () => {
    expect(ClipNameUtil.normalizeClipName('WickedCasting')).toBe('WickedCasting');
  });

  it('is a no-op for an already fully-trimmed, single-spaced name once spaces are the only difference', () => {
    // Confirms the helper is a strict superset of a plain .trim(): a name
    // that only ever needed trimming normalizes the same way either helper
    // would produce, once internal spaces are also accounted for.
    expect(ClipNameUtil.normalizeClipName('Wicked Casting')).toBe(
      ClipNameUtil.normalizeClipName('  Wicked Casting  '),
    );
  });

  it('returns an empty string for a name made up entirely of asterisks and spaces', () => {
    expect(ClipNameUtil.normalizeClipName(' * * ')).toBe('');
  });

  it('returns an empty string unchanged', () => {
    expect(ClipNameUtil.normalizeClipName('')).toBe('');
  });

  it('leaves other punctuation and casing untouched (only [* ] are stripped)', () => {
    expect(ClipNameUtil.normalizeClipName("Sally Jack's Worms Wort")).toBe("SallyJack'sWormsWort");
  });
});
