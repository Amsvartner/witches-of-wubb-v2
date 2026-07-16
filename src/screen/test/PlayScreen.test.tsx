import { render } from '@testing-library/react';
import { PlayScreen } from '~/screen/PlayScreen';

describe('PlayScreen (WOW-007A play-mode spike)', () => {
  it('renders the ceremonial wordmark as the single h1', () => {
    const { getByRole } = render(<PlayScreen />);
    expect(getByRole('heading', { level: 1, name: 'HEXOLOGY' })).toBeInTheDocument();
  });

  it('renders the cauldron centrepiece', () => {
    const { getByAltText } = render(<PlayScreen />);
    expect(getByAltText('Cauldron')).toBeInTheDocument();
  });

  it('renders four pillars with the four categories', () => {
    const { getByText, getAllByText } = render(<PlayScreen />);
    expect(getByText('PILLAR 1')).toBeInTheDocument();
    expect(getByText('PILLAR 4')).toBeInTheDocument();
    // Each category name appears on its pillar and again in the legend.
    ['VOCALS', 'MELODY', 'BASS', 'DRUMS'].forEach((name) => {
      expect(getAllByText(name).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('exposes visible Help and Settings controls', () => {
    const { getByRole } = render(<PlayScreen />);
    expect(getByRole('button', { name: /help/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders the settings band (tempo + key controls)', () => {
    const { getByText, getByRole } = render(<PlayScreen />);
    expect(getByText('130')).toBeInTheDocument();
    expect(getByRole('button', { name: /raise/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /lower/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('renders the sample-type legend', () => {
    const { getByText } = render(<PlayScreen />);
    expect(getByText(/sample types/i)).toBeInTheDocument();
  });
});
