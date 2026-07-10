import { ContextUtils } from '~/context/util/ContextUtils';

describe('ContextUtils.updateIndex', () => {
  const { updateIndex } = ContextUtils;

  it('replaces the value at the given index and returns a new array', () => {
    const initial = [1, 2, 3];
    const result = updateIndex(1, 99, initial);

    expect(result).toEqual([1, 99, 3]);
    expect(result).not.toBe(initial);
  });

  it('does not mutate the input array', () => {
    const initial = [1, 2, 3];
    updateIndex(0, 42, initial);

    expect(initial).toEqual([1, 2, 3]);
  });

  it('supports null values (as used for clearing pillar slots)', () => {
    const initial: (number | null)[] = [10, 20, 30];
    const result = updateIndex(2, null, initial);

    expect(result).toEqual([10, 20, null]);
  });

  it('updates each pillar index independently', () => {
    let clips: (string | null)[] = [null, null, null, null];
    clips = updateIndex(0, 'a', clips);
    clips = updateIndex(3, 'd', clips);

    expect(clips).toEqual(['a', null, null, 'd']);
  });
});
