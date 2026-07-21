import { KeyUtil } from '~/util/KeyUtil';

describe('KeyUtil', () => {
  describe('nextKey', () => {
    it('flips minor (A) to major (B) at the same wheel position', () => {
      expect(KeyUtil.nextKey('1A')).toBe('1B');
      expect(KeyUtil.nextKey('8A')).toBe('8B');
    });

    it('advances major (B) to the next position as minor (A)', () => {
      expect(KeyUtil.nextKey('1B')).toBe('2A');
      expect(KeyUtil.nextKey('8B')).toBe('9A');
    });

    it('wraps forward from 12B to 1A', () => {
      expect(KeyUtil.nextKey('12B')).toBe('1A');
    });

    it('passes through an empty string unchanged', () => {
      expect(KeyUtil.nextKey('')).toBe('');
    });
  });

  describe('prevKey', () => {
    it('flips major (B) to minor (A) at the same wheel position', () => {
      expect(KeyUtil.prevKey('1B')).toBe('1A');
      expect(KeyUtil.prevKey('8B')).toBe('8A');
    });

    it('steps minor (A) back to the previous position as major (B)', () => {
      expect(KeyUtil.prevKey('2A')).toBe('1B');
      expect(KeyUtil.prevKey('9A')).toBe('8B');
    });

    it('wraps backward from 1A to 12B', () => {
      expect(KeyUtil.prevKey('1A')).toBe('12B');
    });

    it('passes through an empty string unchanged', () => {
      expect(KeyUtil.prevKey('')).toBe('');
    });
  });

  describe('nextKey/prevKey round trip', () => {
    it('returns to the original key after a next then a prev', () => {
      expect(KeyUtil.prevKey(KeyUtil.nextKey('5A'))).toBe('5A');
      expect(KeyUtil.prevKey(KeyUtil.nextKey('12B'))).toBe('12B');
    });
  });

  describe('keyQuality', () => {
    it('reports MINOR for an A key', () => {
      expect(KeyUtil.keyQuality('5A')).toBe('MINOR');
    });

    it('reports MAJOR for a B key', () => {
      expect(KeyUtil.keyQuality('5B')).toBe('MAJOR');
    });

    it('reports no quality for an empty (not-yet-detected) key', () => {
      expect(KeyUtil.keyQuality('')).toBe('');
    });
  });
});
