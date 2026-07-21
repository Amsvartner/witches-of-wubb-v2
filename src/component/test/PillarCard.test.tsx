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
      // `pillar.queued` is legacy display data the card no longer reads in
      // DJ mode (queue rows are container-composed via `dj.queueRows` now),
      // but play mode never shows a queue section regardless.
      const { queryByText } = render(<PillarCard pillar={playingVocals} />);
      expect(queryByText('Queued')).not.toBeInTheDocument();
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

    // WOW-007D: a pillar with nothing audible hides its tube entirely in
    // play mode; PillarCardContainer computes when that applies, PillarCard
    // just obeys the prop.
    it('hides the volume tube entirely when hideVolume is true, even with a handler supplied', () => {
      const { queryByRole } = render(
        <PillarCard pillar={playingVocals} onVolumePercentChange={vi.fn()} hideVolume />,
      );
      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('still renders the volume slider when hideVolume is false (default)', () => {
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} onVolumePercentChange={vi.fn()} hideVolume={false} />,
      );
      expect(getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    });

    // WOW-007C: VolumeTube no longer gates interactivity on `assetSlug` — an
    // empty pillar's volume becomes interactive too, once given a handler
    // (DJ mode pre-setting a pillar's level before anything's placed there).
    // PillarCard itself has no notion of play/DJ mode; PillarCardContainer is
    // what decides whether an empty pillar's handler is actually supplied
    // (only in DJ mode — see PillarCardContainer.test.tsx).
    it('renders the volume slider for an empty pillar too, when a handler is supplied', () => {
      const { getByRole } = render(
        <PillarCard pillar={emptyPillar} onVolumePercentChange={vi.fn()} />,
      );
      const slider = getByRole('slider', { name: 'Volume' });
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('does not render a volume slider for an empty pillar without a handler (display-only)', () => {
      const { queryByRole } = render(<PillarCard pillar={emptyPillar} />);
      expect(queryByRole('slider')).not.toBeInTheDocument();
    });

    it('shows no category or controls for an empty pillar', () => {
      const { getByText, queryByText, queryByRole } = render(<PillarCard pillar={emptyPillar} />);
      expect(getByText(/awaiting ingredient/i)).toBeInTheDocument();
      expect(getByText('EMPTY')).toBeInTheDocument();
      expect(queryByText('VOCALS')).not.toBeInTheDocument();
      expect(queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders no empty medallion at all in play mode (samples cannot be added manually there)', () => {
      // Human direction 2026-07-20: the dashed + ring is a DJ-only surface.
      const { queryByRole, queryByText } = render(<PillarCard pillar={emptyPillar} />);
      expect(queryByRole('button', { name: 'Add sample' })).not.toBeInTheDocument();
      expect(queryByText('+')).not.toBeInTheDocument();
    });
  });

  describe('DJ mode (dj prop present)', () => {
    it('renders a Select sample button', () => {
      const { getByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn(), queueRows: [] }} />,
      );
      expect(getByRole('button', { name: 'Select sample' })).toBeInTheDocument();
    });

    it('renders a Stop button when onStop is supplied', () => {
      const { getByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{ onSelectSample: vi.fn(), onStop: vi.fn(), queueRows: [] }}
        />,
      );
      expect(getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    it('renders no Stop button when onStop is absent', () => {
      const { queryByRole } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn(), queueRows: [] }} />,
      );
      expect(queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });

    it('confirm-gates Stop: first tap arms, second tap fires once', () => {
      const onStop = vi.fn();
      const { getByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{ onSelectSample: vi.fn(), onStop, queueRows: [] }}
        />,
      );

      fireEvent.click(getByRole('button', { name: 'Stop' }));
      expect(onStop).not.toHaveBeenCalled();
      expect(getByRole('button', { name: 'Confirm stop' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Confirm stop' }));
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('renders "Queue empty" when there are no queue rows', () => {
      const { getByText } = render(
        <PillarCard pillar={playingVocals} dj={{ onSelectSample: vi.fn(), queueRows: [] }} />,
      );
      expect(getByText('Queued')).toBeInTheDocument();
      expect(getByText('Queue empty')).toBeInTheDocument();
    });

    it('renders a backend-queued row with a confirm-gated remove and no play button', () => {
      const onRemove = vi.fn();
      const { getByText, getByRole, queryByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [{ id: 'v1', name: 'Vocal Hook 07', onRemove }],
          }}
        />,
      );

      expect(getByText('Vocal Hook 07')).toBeInTheDocument();
      expect(queryByRole('button', { name: /play/i })).not.toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Remove Vocal Hook 07' }));
      expect(onRemove).not.toHaveBeenCalled();
      expect(getByRole('button', { name: 'Confirm remove Vocal Hook 07' })).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Confirm remove Vocal Hook 07' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    // WOW-007C item 3 (human spec): every queue row gets Play now, including
    // the backend-queued one — `confirmRemove` (not `onPlay` presence) is
    // what keeps its remove destructive-gated.
    it('renders a backend-queued row with both Play and a confirm-gated remove when the container supplies both', () => {
      const onPlay = vi.fn();
      const onRemove = vi.fn();
      const { getByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [{ id: 'v1', name: 'Vocal Hook 07', onPlay, onRemove, confirmRemove: true }],
          }}
        />,
      );

      fireEvent.click(getByRole('button', { name: 'Play Vocal Hook 07' }));
      expect(onPlay).toHaveBeenCalledTimes(1);

      fireEvent.click(getByRole('button', { name: 'Remove Vocal Hook 07' }));
      expect(onRemove).not.toHaveBeenCalled();
      expect(getByRole('button', { name: 'Confirm remove Vocal Hook 07' })).toBeInTheDocument();
      fireEvent.click(getByRole('button', { name: 'Confirm remove Vocal Hook 07' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders a pending-pick row with Play and a non-confirm-gated remove', () => {
      const onPlay = vi.fn();
      const onRemove = vi.fn();
      const { getByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [{ id: 'pending-1', name: 'Held Sample', onPlay, onRemove }],
          }}
        />,
      );

      fireEvent.click(getByRole('button', { name: 'Play Held Sample' }));
      expect(onPlay).toHaveBeenCalledTimes(1);

      // Not confirm-gated: a single tap removes immediately, no "Confirm?" step.
      fireEvent.click(getByRole('button', { name: 'Remove Held Sample' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders both a backend-queued row and a pending row together, backend-queued first', () => {
      const { getAllByRole } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [
              { id: 'queued-1', name: 'Backend Queued', onRemove: vi.fn() },
              { id: 'pending-1', name: 'Pending Pick', onPlay: vi.fn(), onRemove: vi.fn() },
            ],
          }}
        />,
      );

      const rows = getAllByRole('listitem').map((item) => item.textContent);
      expect(rows[0]).toContain('Backend Queued');
      expect(rows[1]).toContain('Pending Pick');
    });

    it('caps the queued list at two rows', () => {
      const { queryByText } = render(
        <PillarCard
          pillar={playingVocals}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [
              { id: 'a', name: 'Alpha' },
              { id: 'b', name: 'Beta' },
              { id: 'c', name: 'Gamma' },
            ],
          }}
        />,
      );
      expect(queryByText('Alpha')).toBeInTheDocument();
      expect(queryByText('Beta')).toBeInTheDocument();
      expect(queryByText('Gamma')).not.toBeInTheDocument();
    });

    it('renders Select sample (but no Stop or queue section) for an empty pillar with no pending pick', () => {
      // An empty pillar is exactly where the DJ needs to place a clip, so
      // Select sample renders regardless of category; Stop stays absent
      // (no active clip to stop) and the queue section stays gated on a
      // real category OR a pending pick — nothing to queue on a plain empty
      // pillar.
      const { getByRole, queryByRole, queryByText } = render(
        <PillarCard pillar={emptyPillar} dj={{ onSelectSample: vi.fn(), queueRows: [] }} />,
      );
      expect(getByRole('button', { name: 'Select sample' })).toBeInTheDocument();
      expect(queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
      expect(queryByText('Queued')).not.toBeInTheDocument();
    });

    it('renders the empty medallion as an Add sample button that opens the picker', () => {
      const onSelectSample = vi.fn();
      const { getByRole } = render(
        <PillarCard pillar={emptyPillar} dj={{ onSelectSample, queueRows: [] }} />,
      );

      fireEvent.click(getByRole('button', { name: 'Add sample' }));
      expect(onSelectSample).toHaveBeenCalledTimes(1);
    });

    it('shows the Queued section and a working Play button on an empty pillar with a pending pick', () => {
      // The gap this closes: picking a sample via the empty-medallion Add
      // button has to land somewhere the DJ can actually start it, even
      // though an empty pillar has no category tokens.
      const onPlay = vi.fn();
      const { getByText, getByRole } = render(
        <PillarCard
          pillar={emptyPillar}
          dj={{
            onSelectSample: vi.fn(),
            queueRows: [{ id: 'pending-empty', name: 'Held For Empty', onPlay, onRemove: vi.fn() }],
          }}
        />,
      );

      expect(getByText('Queued')).toBeInTheDocument();
      expect(getByText('Held For Empty')).toBeInTheDocument();

      fireEvent.click(getByRole('button', { name: 'Play Held For Empty' }));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    describe('mute', () => {
      it('renders a Mute button on a categorised pillar when muted + onToggleMute are supplied', () => {
        const onToggleMute = vi.fn();
        const { getByRole } = render(
          <PillarCard
            pillar={playingVocals}
            dj={{ onSelectSample: vi.fn(), queueRows: [], muted: false, onToggleMute }}
          />,
        );

        fireEvent.click(getByRole('button', { name: 'Mute' }));
        expect(onToggleMute).toHaveBeenCalledTimes(1);
      });

      it('shows Unmute and a MUTED status label when muted is true', () => {
        const { getByRole, getByText } = render(
          <PillarCard
            pillar={{ ...playingVocals, muted: true }}
            dj={{ onSelectSample: vi.fn(), queueRows: [], muted: true, onToggleMute: vi.fn() }}
          />,
        );

        expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
        expect(getByText('MUTED')).toBeInTheDocument();
      });

      // WOW-007C human decision (2026-07-21): the DJ can mute an EMPTY
      // pillar too, pre-setting it to silent before any clip lands there
      // (the backend persists desiredVolumes per pillar) — Mute is no
      // longer gated on the pillar having a category.
      it('renders a Mute button on an empty pillar when muted/onToggleMute are supplied', () => {
        const onToggleMute = vi.fn();
        const { getByRole } = render(
          <PillarCard
            pillar={emptyPillar}
            dj={{ onSelectSample: vi.fn(), queueRows: [], muted: false, onToggleMute }}
          />,
        );

        fireEvent.click(getByRole('button', { name: 'Mute' }));
        expect(onToggleMute).toHaveBeenCalledTimes(1);
      });

      it('shows Unmute on an empty pillar when muted is true, with no MUTED status label (no category line to carry it)', () => {
        const { getByRole, queryByText } = render(
          <PillarCard
            pillar={{ ...emptyPillar, muted: true }}
            dj={{ onSelectSample: vi.fn(), queueRows: [], muted: true, onToggleMute: vi.fn() }}
          />,
        );

        expect(getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
        expect(queryByText('MUTED')).not.toBeInTheDocument();
      });
    });
  });
});
