import { render } from '@testing-library/react';
import { EmptyStateOverlay } from '~/component/EmptyStateOverlay';

describe('EmptyStateOverlay', () => {
  it('renders the invitation copy', () => {
    const { getByText } = render(<EmptyStateOverlay />);

    expect(getByText('The cauldron slumbers…')).toBeInTheDocument();
    expect(getByText('Place an ingredient upon a pillar to begin the spell ✦')).toBeInTheDocument();
  });

  it('is pointer-events-none so it never intercepts touches', () => {
    const { container } = render(<EmptyStateOverlay />);

    expect(container.firstChild).toHaveClass('pointer-events-none');
  });
});
