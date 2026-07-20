import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { VolumeTube } from '~/component/VolumeTube';

describe('VolumeTube', () => {
  it('renders the labelled display percentage with the category art', () => {
    const { getByText, getAllByText, container } = render(
      <VolumeTube volumePercent={67} assetSlug='amber' />,
    );
    expect(getByText('Volume')).toBeInTheDocument();
    // The value renders twice: visible (aria-hidden) + screen-reader text.
    expect(getAllByText('67%')).toHaveLength(2);
    // Dimmed base tube + lit fill + gem.
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('clamps out-of-range volume to 0–100%', () => {
    const over = render(<VolumeTube volumePercent={150} assetSlug='red' />);
    expect(over.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    const under = render(<VolumeTube volumePercent={-10} assetSlug='red' />);
    expect(under.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders an empty, non-interactive pillar without label, percentage, fill, or gem', () => {
    const { queryByText, container } = render(<VolumeTube volumePercent={0} />);
    expect(queryByText('Volume')).not.toBeInTheDocument();
    expect(queryByText(/%/)).not.toBeInTheDocument();
    // Only the desaturated base tube remains.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  // WOW-007C: an empty pillar with a volume handler (DJ mode pre-setting a
  // pillar's level before anything plays there) is interactive even without
  // assetSlug — the empty-glass art is the drag track, no gem/fill overlay.
  describe('empty pillar, interactive (WOW-007C)', () => {
    it('exposes the slider role and readout even without assetSlug', () => {
      const { getByRole, getAllByText, container } = render(
        <VolumeTube volumePercent={42} onPercentChange={vi.fn()} />,
      );
      const slider = getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuenow', '42');
      expect(getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
      // Visible (aria-hidden) percentage renders; no sr-only duplicate since
      // the slider role itself already carries aria-valuetext.
      expect(getAllByText('42%')).toHaveLength(1);
      // No fill/gem overlay (no assetSlug) — only the desaturated base tube.
      expect(container.querySelectorAll('img')).toHaveLength(1);
    });

    it('calls onPercentChange on arrow-key nudges', () => {
      const onPercentChange = vi.fn();
      const { getByRole } = render(
        <VolumeTube volumePercent={50} onPercentChange={onPercentChange} />,
      );
      fireEvent.keyDown(getByRole('slider'), { key: 'ArrowUp' });
      expect(onPercentChange).toHaveBeenCalledWith(55);
    });
  });
});
