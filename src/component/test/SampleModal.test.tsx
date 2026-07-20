import { fireEvent, render, within } from '@testing-library/react';
import { vi } from 'vitest';
import { ClipTypes } from 'backend/type/ClipTypes';
import { SampleModal, type ActiveByRfid, type SelectableClip } from '~/component/SampleModal';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally (same stub pattern as DebugModalContainer.test.tsx /
// PlayScreen.test.tsx / PillarCardContainer.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const CLIPS: SelectableClip[] = [
  {
    rfid: 'rfid-vox-1',
    clipName: 'Vocal Hook 07',
    type: ClipTypes.Vox,
    artist: 'DJ Cauldron',
    bpm: 128,
    key: '4A',
    instrument: 'Vox',
  },
  {
    rfid: 'rfid-melody-1',
    clipName: 'Astral Melody Loop',
    type: ClipTypes.Melody,
    songTitle: 'Wandering Star',
    bpm: 122,
    key: '10A',
    instrument: 'Electric Guitar',
  },
  {
    rfid: 'rfid-bass-1',
    clipName: 'Basement Growl',
    type: ClipTypes.Bass,
    bpm: 140,
    key: '2A',
    instrument: 'Bass Guitar',
  },
  {
    rfid: 'rfid-drums-1',
    clipName: 'Zephyr Drums',
    type: ClipTypes.Drums,
    // No bpm/key/instrument on purpose — must always sort last on those
    // columns' sorts.
  },
];

const renderModal = (overrides: Partial<Parameters<typeof SampleModal>[0]> = {}) => {
  const onClose = vi.fn();
  const onTogglePillar = vi.fn();
  const utils = render(
    <SampleModal
      open
      onClose={onClose}
      pillarNumber={1}
      clips={CLIPS}
      onTogglePillar={onTogglePillar}
      activeByRfid={{}}
      {...overrides}
    />,
  );
  return { ...utils, onClose, onTogglePillar };
};

/** The `<li>` row for a given clip name — scopes chip queries to one row. */
const getRow = (getByText: (text: string) => HTMLElement, clipName: string): HTMLElement =>
  getByText(clipName).closest('li') as HTMLElement;

describe('SampleModal (WOW-007B search/filter/sort/instrument/pillar-chip columns)', () => {
  it('narrows the list by clip name', () => {
    const { getByLabelText, getByText, queryByText } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'vocal' } });

    expect(getByText('Vocal Hook 07')).toBeInTheDocument();
    expect(queryByText('Astral Melody Loop')).not.toBeInTheDocument();
    expect(getByText('1 samples')).toBeInTheDocument();
  });

  it('narrows the list by artist', () => {
    const { getByLabelText, getByText, queryByText } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'cauldron' } });

    expect(getByText('Vocal Hook 07')).toBeInTheDocument();
    expect(queryByText('Basement Growl')).not.toBeInTheDocument();
  });

  it('narrows the list by song title', () => {
    const { getByLabelText, getByText, queryByText } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'wandering' } });

    expect(getByText('Astral Melody Loop')).toBeInTheDocument();
    expect(queryByText('Vocal Hook 07')).not.toBeInTheDocument();
  });

  it('restores the full list via the clear button', () => {
    const { getByLabelText, getByRole, getByText, queryByText } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'vocal' } });
    expect(queryByText('Astral Melody Loop')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Clear search' }));

    expect(getByLabelText('Search samples')).toHaveValue('');
    expect(getByText('Astral Melody Loop')).toBeInTheDocument();
    expect(getByText('4 samples')).toBeInTheDocument();
  });

  it('filters by category chip and reflects aria-pressed', () => {
    const { getByRole, getByText, queryByText } = renderModal();

    const allChip = getByRole('button', { name: 'All' });
    const bassChip = getByRole('button', { name: 'Bass' });
    expect(allChip).toHaveAttribute('aria-pressed', 'true');
    expect(bassChip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(bassChip);

    expect(bassChip).toHaveAttribute('aria-pressed', 'true');
    expect(allChip).toHaveAttribute('aria-pressed', 'false');
    expect(getByText('Basement Growl')).toBeInTheDocument();
    expect(queryByText('Vocal Hook 07')).not.toBeInTheDocument();
    expect(getByText('1 samples')).toBeInTheDocument();
  });

  describe('sortable column headers', () => {
    it('defaults to Name ascending with an aria-sort indicator', () => {
      const { getByRole } = renderModal();
      expect(getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    });

    it('toggles the Name column to descending on a second click', () => {
      const { getByRole, getAllByRole } = renderModal();

      fireEvent.click(getByRole('columnheader', { name: /Name/ }));

      expect(getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
      const orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Zephyr Drums');
      expect(orderedNames[3]).toContain('Astral Melody Loop');
    });

    it('clicking a different column switches to it ascending (not carrying over the prior direction)', () => {
      const { getByRole } = renderModal();

      fireEvent.click(getByRole('columnheader', { name: /Name/ })); // Name -> descending
      fireEvent.click(getByRole('columnheader', { name: /BPM/ })); // switch column

      expect(getByRole('columnheader', { name: /BPM/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none');
    });

    it('sorts by BPM ascending with missing-bpm clips last, then descending keeps them last', () => {
      const { getByRole, getAllByRole } = renderModal();

      fireEvent.click(getByRole('columnheader', { name: /BPM/ }));
      let orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Astral Melody Loop'); // 122
      expect(orderedNames[1]).toContain('Vocal Hook 07'); // 128
      expect(orderedNames[2]).toContain('Basement Growl'); // 140
      expect(orderedNames[3]).toContain('Zephyr Drums'); // no bpm, last

      fireEvent.click(getByRole('columnheader', { name: /BPM/ }));
      expect(getByRole('columnheader', { name: /BPM/ })).toHaveAttribute('aria-sort', 'descending');
      orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Basement Growl'); // 140
      expect(orderedNames[1]).toContain('Vocal Hook 07'); // 128
      expect(orderedNames[2]).toContain('Astral Melody Loop'); // 122
      expect(orderedNames[3]).toContain('Zephyr Drums'); // still last
    });

    it('sorts by Key numerically — 2A before 10A, missing key last in both directions', () => {
      const { getByRole, getAllByRole } = renderModal();

      fireEvent.click(getByRole('columnheader', { name: /Key/ }));
      let orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Basement Growl'); // 2A
      expect(orderedNames[1]).toContain('Vocal Hook 07'); // 4A
      expect(orderedNames[2]).toContain('Astral Melody Loop'); // 10A
      expect(orderedNames[3]).toContain('Zephyr Drums'); // no key, last

      fireEvent.click(getByRole('columnheader', { name: /Key/ }));
      orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Astral Melody Loop'); // 10A
      expect(orderedNames[1]).toContain('Vocal Hook 07'); // 4A
      expect(orderedNames[2]).toContain('Basement Growl'); // 2A
      expect(orderedNames[3]).toContain('Zephyr Drums'); // still last
    });

    it('sorts by Type in Vox/Melody/Bass/Drums order', () => {
      const { getByRole, getAllByRole } = renderModal();

      fireEvent.click(getByRole('columnheader', { name: /Type/ }));

      const orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Vocal Hook 07'); // Vox
      expect(orderedNames[1]).toContain('Astral Melody Loop'); // Melody
      expect(orderedNames[2]).toContain('Basement Growl'); // Bass
      expect(orderedNames[3]).toContain('Zephyr Drums'); // Drums
    });

    it('renders each clip’s instrument and sorts alphabetically with missing instrument last, both directions', () => {
      const { getByText, getByRole, getAllByRole } = renderModal();

      expect(getByText('Electric Guitar')).toBeInTheDocument();

      fireEvent.click(getByRole('columnheader', { name: /Instrument/ }));
      let orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Basement Growl'); // Bass Guitar
      expect(orderedNames[1]).toContain('Astral Melody Loop'); // Electric Guitar
      expect(orderedNames[2]).toContain('Vocal Hook 07'); // Vox
      expect(orderedNames[3]).toContain('Zephyr Drums'); // no instrument, last

      fireEvent.click(getByRole('columnheader', { name: /Instrument/ }));
      expect(getByRole('columnheader', { name: /Instrument/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
      orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Vocal Hook 07'); // Vox
      expect(orderedNames[1]).toContain('Astral Melody Loop'); // Electric Guitar
      expect(orderedNames[2]).toContain('Basement Growl'); // Bass Guitar
      expect(orderedNames[3]).toContain('Zephyr Drums'); // still last
    });

    it('sorts by Pillar — active clips ordered by pillar number, inactive ones last (stable by name)', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-bass-1': { pillarNumber: 1, state: 'playing' },
        'rfid-vox-1': { pillarNumber: 2, state: 'queued' },
      };
      const { getByRole, getAllByRole } = renderModal({ activeByRfid });

      fireEvent.click(getByRole('columnheader', { name: /Pillar/ }));

      const orderedNames = getAllByRole('listitem').map((item) => item.textContent);
      expect(orderedNames[0]).toContain('Basement Growl'); // P1
      expect(orderedNames[1]).toContain('Vocal Hook 07'); // P2
      expect(orderedNames[2]).toContain('Astral Melody Loop'); // inactive, stable by name
      expect(orderedNames[3]).toContain('Zephyr Drums'); // inactive, stable by name
    });
  });

  describe('pillar chips (WOW-007B queueing replaces row-tap picking)', () => {
    it('renders 4 enabled, outlined, unpressed chips per row when a clip is not active anywhere', () => {
      const { getByText } = renderModal();
      const row = getRow(getByText, 'Zephyr Drums');

      [1, 2, 3, 4].forEach((pillarNumber) => {
        const chip = within(row).getByRole('button', {
          name: `Queue Zephyr Drums on pillar ${pillarNumber}`,
        });
        expect(chip).toBeEnabled();
        expect(chip).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('tapping an outlined chip calls onTogglePillar with the 0-based pillar index and the clip', () => {
      const { getByRole, onTogglePillar } = renderModal();

      fireEvent.click(getByRole('button', { name: 'Queue Vocal Hook 07 on pillar 3' }));

      expect(onTogglePillar).toHaveBeenCalledTimes(1);
      expect(onTogglePillar).toHaveBeenCalledWith(2, CLIPS[0]);
    });

    it('does not close the modal when a chip is tapped', () => {
      const { getByRole, onClose } = renderModal();

      fireEvent.click(getByRole('button', { name: 'Queue Vocal Hook 07 on pillar 1' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('renders the pending-on-this-pillar chip filled and pressed, and tapping it calls onTogglePillar to remove it', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 1, state: 'pending' },
      };
      const { getByRole, onTogglePillar } = renderModal({ activeByRfid, pillarNumber: 1 });

      const chip = getByRole('button', { name: 'Remove Vocal Hook 07 from pillar 1 queue' });
      expect(chip).toHaveAttribute('aria-pressed', 'true');
      expect(chip).toBeEnabled();

      fireEvent.click(chip);

      expect(onTogglePillar).toHaveBeenCalledWith(0, CLIPS[0]);
    });

    it('leaves the other 3 chips outlined and tappable while one chip is pending on this pillar (supports moving)', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 1, state: 'pending' },
      };
      const { getByRole, onTogglePillar } = renderModal({ activeByRfid, pillarNumber: 1 });

      const otherChip = getByRole('button', { name: 'Queue Vocal Hook 07 on pillar 2' });
      expect(otherChip).toBeEnabled();

      fireEvent.click(otherChip);

      expect(onTogglePillar).toHaveBeenCalledWith(1, CLIPS[0]);
    });

    it('disables the backend-active chip with a state title, and disables every other chip on that row', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 2, state: 'queued' },
      };
      const { getByText } = renderModal({ activeByRfid });
      const row = getRow(getByText, 'Vocal Hook 07');

      const activeChip = within(row).getByRole('button', { name: 'P2' });
      expect(activeChip).toBeDisabled();
      expect(activeChip).toHaveAttribute('title', 'Queued on pillar 2');

      [1, 3, 4].forEach((pillarNumber) => {
        const otherChip = within(row).getByRole('button', { name: `P${pillarNumber}` });
        expect(otherChip).toBeDisabled();
      });
    });

    it('shows a Playing title on the active chip for a playing clip', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-bass-1': { pillarNumber: 3, state: 'playing' },
      };
      const { getByText } = renderModal({ activeByRfid });
      const row = getRow(getByText, 'Basement Growl');

      expect(within(row).getByRole('button', { name: 'P3' })).toHaveAttribute(
        'title',
        'Playing on pillar 3',
      );
    });

    it('shows a Stopping title on the active chip for a stopping clip', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-bass-1': { pillarNumber: 3, state: 'stopping' },
      };
      const { getByText } = renderModal({ activeByRfid });
      const row = getRow(getByText, 'Basement Growl');

      expect(within(row).getByRole('button', { name: 'P3' })).toHaveAttribute(
        'title',
        'Stopping on pillar 3',
      );
    });
  });

  it('shows an empty state with a working reset when the filters yield nothing', () => {
    const { getByLabelText, getByRole, getByText, queryByText } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'nonexistent-xyz' } });

    expect(getByText('No samples match')).toBeInTheDocument();
    expect(queryByText('Vocal Hook 07')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Reset filters' }));

    expect(getByLabelText('Search samples')).toHaveValue('');
    expect(getByText('Vocal Hook 07')).toBeInTheDocument();
    expect(getByText('4 samples')).toBeInTheDocument();
  });

  it('resets search/filter/sort state when the modal reopens', () => {
    const { getByLabelText, getByRole, rerender } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'vocal' } });
    fireEvent.click(getByRole('button', { name: 'Bass' }));
    fireEvent.click(getByRole('columnheader', { name: /BPM/ }));

    rerender(
      <SampleModal
        open={false}
        onClose={() => {}}
        pillarNumber={1}
        clips={CLIPS}
        onTogglePillar={() => {}}
        activeByRfid={{}}
      />,
    );
    rerender(
      <SampleModal
        open
        onClose={() => {}}
        pillarNumber={1}
        clips={CLIPS}
        onTogglePillar={() => {}}
        activeByRfid={{}}
      />,
    );

    expect(getByLabelText('Search samples')).toHaveValue('');
    expect(getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});
