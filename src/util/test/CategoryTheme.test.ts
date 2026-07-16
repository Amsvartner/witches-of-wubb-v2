import { ClipTypes } from 'backend/type/ClipTypes';
import { CategoryTheme } from '~/util/CategoryTheme';
import { ColorUtil } from '~/util/ColorUtil';

describe('CategoryTheme.forType', () => {
  it('sources the fill class from ColorUtil (single source of truth)', () => {
    (Object.values(ClipTypes) as ClipTypes[]).forEach((type) => {
      expect(CategoryTheme.forType(type).fillClass).toBe(
        ColorUtil.getBackgroundColorFromType(type),
      );
    });
  });

  it('returns the display label and an AA text tint for each category', () => {
    expect(CategoryTheme.forType(ClipTypes.Vox).label).toBe('VOCALS');
    expect(CategoryTheme.forType(ClipTypes.Melody).label).toBe('MELODY');
    expect(CategoryTheme.forType(ClipTypes.Melody).tintClass).toBe('text-amber-300');
    expect(CategoryTheme.forType(ClipTypes.Drums).tintClass).toBe('text-blue-300');
  });

  it('warms the Melody fill to yellow-600 (WOW-007A)', () => {
    expect(CategoryTheme.forType(ClipTypes.Melody).fillClass).toBe('bg-yellow-600');
    expect(CategoryTheme.forType(ClipTypes.Melody).fillHex).toBe('#ca8a04');
  });

  it('keeps fillHex in sync with the resolved Tailwind class for every category', () => {
    // Default-palette hex values of the Tailwind classes ColorUtil returns.
    const RESOLVED: Record<string, string> = {
      'bg-red-700': '#b91c1c',
      'bg-yellow-600': '#ca8a04',
      'bg-green-700': '#15803d',
      'bg-blue-700': '#1d4ed8',
    };
    (Object.values(ClipTypes) as ClipTypes[]).forEach((type) => {
      const { fillClass, fillHex } = CategoryTheme.forType(type);
      expect(fillHex).toBe(RESOLVED[fillClass]);
    });
  });
});
