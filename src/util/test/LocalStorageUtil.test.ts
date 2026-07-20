import { vi } from 'vitest';
import { LocalStorageUtil } from '~/util/LocalStorageUtil';

describe('LocalStorageUtil', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null for a key that was never set', () => {
    expect(LocalStorageUtil.get('missing-key')).toBeNull();
  });

  it('round-trips a value through set/get', () => {
    LocalStorageUtil.set('hexology.mode', 'dj');
    expect(LocalStorageUtil.get('hexology.mode')).toBe('dj');
  });

  it('returns null instead of throwing when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked in private mode');
    });

    expect(LocalStorageUtil.get('any-key')).toBeNull();

    spy.mockRestore();
  });

  it('no-ops instead of throwing when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => LocalStorageUtil.set('any-key', 'value')).not.toThrow();

    spy.mockRestore();
  });
});
