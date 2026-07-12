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

  it('normalizes a padded variant to the same result as its already-trimmed counterpart (not a no-op - the internal space is stripped from both)', () => {
    // Confirms the helper is a strict superset of a plain .trim(): two
    // spellings of "the same" name that only differ by leading/trailing
    // whitespace collapse to one identical key, exactly like .trim() alone
    // would - but note neither side is returned unchanged, since the
    // internal space between "Wicked" and "Casting" is stripped from both.
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
