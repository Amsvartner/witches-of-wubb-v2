import { render } from '@testing-library/react';
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

  it('renders an empty pillar without label, percentage, fill, or gem', () => {
    const { queryByText, container } = render(<VolumeTube volumePercent={0} />);
    expect(queryByText('Volume')).not.toBeInTheDocument();
    expect(queryByText(/%/)).not.toBeInTheDocument();
    // Only the desaturated base tube remains.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
