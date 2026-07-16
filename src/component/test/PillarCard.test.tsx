import { render } from '@testing-library/react';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarCard } from '~/component/PillarCard';
import { PillarView } from '~/type/PillarView';

const vocalsPillar: PillarView = {
  pillarNumber: 1,
  category: ClipTypes.Vox,
  status: 'playing',
  muted: false,
  volumePercent: 82,
  queued: [
    { id: 'v1', name: 'Vocal Hook 07' },
    { id: 'v2', name: 'Vocal Chop 14' },
  ],
};

const emptyPillar: PillarView = {
  pillarNumber: 4,
  status: 'empty',
  muted: false,
  volumePercent: 0,
  queued: [],
};

describe('PillarCard', () => {
  it('shows category identity, status, controls and queued rows for an active pillar', () => {
    const { getByText, getByRole } = render(<PillarCard pillar={vocalsPillar} />);
    expect(getByText('PILLAR 1')).toBeInTheDocument();
    expect(getByText('VOCALS')).toBeInTheDocument();
    expect(getByText('PLAYING')).toBeInTheDocument();
    // Per-pillar controls.
    expect(getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /mute/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /select sample/i })).toBeInTheDocument();
    // Queued sample rows with play + remove controls.
    expect(getByText('Vocal Hook 07')).toBeInTheDocument();
    expect(getByText('Vocal Chop 14')).toBeInTheDocument();
    expect(getByRole('button', { name: /play vocal hook 07/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /remove vocal chop 14/i })).toBeInTheDocument();
  });

  it('caps the queued list at two rows', () => {
    const threeQueued: PillarView = {
      ...vocalsPillar,
      queued: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
        { id: 'c', name: 'Gamma' },
      ],
    };
    const { queryByText } = render(<PillarCard pillar={threeQueued} />);
    expect(queryByText('Alpha')).toBeInTheDocument();
    expect(queryByText('Beta')).toBeInTheDocument();
    expect(queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('shows PAUSED with a Play control when paused', () => {
    const paused: PillarView = { ...vocalsPillar, status: 'paused' };
    const { getByText, getByRole, queryByRole } = render(<PillarCard pillar={paused} />);
    expect(getByText('PAUSED')).toBeInTheDocument();
    expect(getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('shows an Unmute control when muted', () => {
    const muted: PillarView = { ...vocalsPillar, muted: true };
    const { getByRole, queryByRole } = render(<PillarCard pillar={muted} />);
    expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
  });

  it('shows no category or controls for an empty pillar', () => {
    const { getByText, queryByText, queryByRole } = render(<PillarCard pillar={emptyPillar} />);
    expect(getByText('PILLAR 4')).toBeInTheDocument();
    expect(getByText(/awaiting ingredient/i)).toBeInTheDocument();
    expect(getByText('EMPTY')).toBeInTheDocument();
    expect(queryByText('DRUMS')).not.toBeInTheDocument();
    // No controls or queue on an empty pillar.
    expect(queryByRole('button', { name: /select sample/i })).not.toBeInTheDocument();
  });
});
