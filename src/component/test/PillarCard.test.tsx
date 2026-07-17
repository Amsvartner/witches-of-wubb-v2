import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarCard } from '~/component/PillarCard';
import { PillarView } from '~/type/PillarView';

const playingVocals: PillarView = {
  pillarNumber: 1,
  category: ClipTypes.Vox,
  status: 'playing',
  muted: false,
  volumePercent: 82,
  queued: [],
};

const queuedVocals: PillarView = {
  ...playingVocals,
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
  describe('play mode (no dj prop)', () => {
    it('shows category identity and status', () => {
      const { getByRole, getByText } = render(<PillarCard pillar={playingVocals} />);
      expect(getByRole('heading', { name: 'VOCALS' })).toBeInTheDocument();
      expect(getByText('PLAYING')).toBeInTheDocument();
    });

    it('renders no queue section, even when the pillar has queued samples', () => {
      const { queryByText } = render(<PillarCard pillar={queuedVocals} />);
      expect(queryByText('Queued')).not.toBeInTheDocument();
      expect(queryByText('Vocal Hook 07')).not.toBeInTheDocument();
    });

    it('renders no buttons at all on the card', () => {
      const { container } = render(<PillarCard pillar={playingVocals} />);
      expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    it('renders the volume slider when a volume handler is supplied', () => {
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} onVolumePercentChange={vi.fn()} />,
      );
      const slider = getByRole('slider', { name: 'Volume' });
      expect(slider).toHaveAttribute('aria-valuenow', '82');
    });

    it('does not render a volume slider without a handler (display-only)', () => {
      const { queryByRole } = render(<PillarCard pillar={playingVocals} />);
      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('does not render a volume slider for an empty pillar, even with a handler', () => {
      const { queryByRole } = render(
        <PillarCard pillar={emptyPillar} onVolumePercentChange={vi.fn()} />,
      );
      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('shows no category or controls for an empty pillar', () => {
      const { getByText, queryByText, queryByRole } = render(<PillarCard pillar={emptyPillar} />);
      expect(getByText(/awaiting ingredient/i)).toBeInTheDocument();
      expect(getByText('EMPTY')).toBeInTheDocument();
      expect(queryByText('VOCALS')).not.toBeInTheDocument();
      expect(queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('DJ mode (dj prop present)', () => {
    it('renders a Select sample button', () => {
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn() }} />,
      );
      expect(getByRole('button', { name: 'Select sample' })).toBeInTheDocument();
    });

    it('renders a Stop button when onStop is supplied', () => {
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn(), onStop: vi.fn() }} />,
      );
      expect(getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    it('renders no Stop button when onStop is absent', () => {
      const { queryByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn() }} />,
      );
      expect(queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });

    it('confirm-gates Stop: first tap arms, second tap fires once', () => {
      const onStop = vi.fn();
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn(), onStop }} />,
      );

      fireEvent.click(getByRole('button', { name: 'Stop' }));
      expect(onStop).not.toHaveBeenCalled();
      expect(getByRole('button', { name: 'Confirm stop' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Confirm stop' }));
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('renders "Queue empty" when there are no queued samples', () => {
      const { getByText } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{ onSelectSample: vi.fn(), onRemoveQueued: vi.fn() }}
        />,
      );
      expect(getByText('Queued')).toBeInTheDocument();
      expect(getByText('Queue empty')).toBeInTheDocument();
    });

    it('renders queued sample rows with a confirm-gated remove and no play button', () => {
      const onRemoveQueued = vi.fn();
      const { getByText, getByRole, queryByRole } = render(
        <PillarCard pillar={queuedVocals} dj={{ onSelectSample: vi.fn(), onRemoveQueued }} />,
      );

      expect(getByText('Vocal Hook 07')).toBeInTheDocument();
      expect(getByText('Vocal Chop 14')).toBeInTheDocument();
      expect(queryByRole('button', { name: /play/i })).not.toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Remove Vocal Hook 07' }));
      expect(onRemoveQueued).not.toHaveBeenCalled();
      expect(getByRole('button', { name: 'Confirm remove Vocal Hook 07' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Confirm remove Vocal Hook 07' }));
      expect(onRemoveQueued).toHaveBeenCalledTimes(1);
    });

    it('caps the queued list at two rows', () => {
      const threeQueued: PillarView = {
        ...playingVocals,
        queued: [
          { id: 'a', name: 'Alpha' },
          { id: 'b', name: 'Beta' },
          { id: 'c', name: 'Gamma' },
        ],
      };
      const { queryByText } = render(
        <PillarCard
          pillar={threeQueued}
          dj={{ onSelectSample: vi.fn(), onRemoveQueued: vi.fn() }}
        />,
      );
      expect(queryByText('Alpha')).toBeInTheDocument();
      expect(queryByText('Beta')).toBeInTheDocument();
      expect(queryByText('Gamma')).not.toBeInTheDocument();
    });

    it('renders Select sample (but no Stop or queue section) for an empty pillar', () => {
      // An empty pillar is exactly where the DJ needs to place a clip, so
      // Select sample renders regardless of category; Stop stays absent
      // (no active clip to stop) and the queue section stays gated on a
      // real category (nothing to queue on an empty pillar).
      const { getByRole, queryByRole, queryByText } = render(
        <PillarCard pillar={emptyPillar} dj={{ onSelectSample: vi.fn() }} />,
      );
      expect(getByRole('button', { name: 'Select sample' })).toBeInTheDocument();
      expect(queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
      expect(queryByText('Queued')).not.toBeInTheDocument();
    });
  });
});
