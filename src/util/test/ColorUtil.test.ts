import { ClipTypes } from 'backend/type/ClipTypes';
import { ColorUtil } from '~/util/ColorUtil';

describe('ColorUtil.getBackgroundColorFromType', () => {
  it('maps each clip category to its canonical color class (PRD F4)', () => {
    expect(ColorUtil.getBackgroundColorFromType(ClipTypes.Vox)).toBe('bg-red-700');
    expect(ColorUtil.getBackgroundColorFromType(ClipTypes.Bass)).toBe('bg-green-700');
    expect(ColorUtil.getBackgroundColorFromType(ClipTypes.Drums)).toBe('bg-blue-700');
    expect(ColorUtil.getBackgroundColorFromType(ClipTypes.Melody)).toBe('bg-yellow-700');
  });

  it('falls back to white for unknown or missing types', () => {
    expect(ColorUtil.getBackgroundColorFromType(undefined)).toBe('bg-white');
    expect(ColorUtil.getBackgroundColorFromType('Kazoo')).toBe('bg-white');
  });
});
