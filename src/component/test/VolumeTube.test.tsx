import { render } from '@testing-library/react';
import { VolumeTube } from '~/component/VolumeTube';

describe('VolumeTube', () => {
  it('renders the display percentage with the category art', () => {
    const { getByText, container } = render(<VolumeTube volumePercent={67} assetSlug='amber' />);
    expect(getByText('67%')).toBeInTheDocument();
    // Dimmed base tube + lit fill + gem.
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('clamps out-of-range volume to 0–100%', () => {
    const over = render(<VolumeTube volumePercent={150} assetSlug='red' />);
    expect(over.getByText('100%')).toBeInTheDocument();
    const under = render(<VolumeTube volumePercent={-10} assetSlug='red' />);
    expect(under.getByText('0%')).toBeInTheDocument();
  });

  it('renders an empty pillar without percentage, fill, or gem', () => {
    const { queryByText, container } = render(<VolumeTube volumePercent={0} />);
    expect(queryByText(/%/)).not.toBeInTheDocument();
    // Only the desaturated base tube remains.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
