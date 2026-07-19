import { fireEvent, render } from '@testing-library/react';
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
  },
  {
    rfid: 'rfid-melody-1',
    clipName: 'Astral Melody Loop',
    type: ClipTypes.Melody,
    songTitle: 'Wandering Star',
    bpm: 122,
    key: '10A',
  },
  {
    rfid: 'rfid-bass-1',
    clipName: 'Basement Growl',
    type: ClipTypes.Bass,
    bpm: 140,
    key: '2A',
  },
  {
    rfid: 'rfid-drums-1',
    clipName: 'Zephyr Drums',
    type: ClipTypes.Drums,
    // No bpm/key on purpose — must always sort last on bpm/key sorts.
  },
];

const renderModal = (overrides: Partial<Parameters<typeof SampleModal>[0]> = {}) => {
  const onClose = vi.fn();
  const onPick = vi.fn();
  const utils = render(
    <SampleModal
      open
      onClose={onClose}
      pillarNumber={1}
      clips={CLIPS}
      onPick={onPick}
      activeByRfid={{}}
      {...overrides}
    />,
  );
  return { ...utils, onClose, onPick };
};

describe('SampleModal (WOW-007B search/filter/sort/pillar columns)', () => {
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

  describe('active/pending state — disabled rows and the Pillar cell', () => {
    it('shows a dash in the Pillar column for every clip when none are active', () => {
      // Missing bpm/key also render '—', so this checks the Pillar cell
      // specifically (each row's button's last column) rather than counting
      // '—' text anywhere on the page.
      const { getAllByRole } = renderModal();
      const pillarCells = getAllByRole('listitem').map(
        (row) => row.querySelector('button')?.lastElementChild?.textContent,
      );
      expect(pillarCells).toEqual(['—', '—', '—', '—']);
    });

    it('disables a row active on another pillar and shows its pillar + state hint', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 2, state: 'queued' },
      };
      const { getByText } = renderModal({ activeByRfid, pillarNumber: 1 });

      expect(getByText('P2 ·q')).toBeInTheDocument();
      const row = getByText('Vocal Hook 07').closest('button');
      expect(row).toBeDisabled();
    });

    it('shows the stopping hint for a stopping clip', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-bass-1': { pillarNumber: 3, state: 'stopping' },
      };
      const { getByText } = renderModal({ activeByRfid });
      expect(getByText('P3 ·s')).toBeInTheDocument();
    });

    it('shows the playing pillar with no suffix', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-bass-1': { pillarNumber: 3, state: 'playing' },
      };
      const { getByText } = renderModal({ activeByRfid });
      expect(getByText('P3')).toBeInTheDocument();
    });

    it('does not disable a clip pending on THIS SAME pillar and allows re-picking it', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 1, state: 'pending' },
      };
      const { getByText, onPick } = renderModal({ activeByRfid, pillarNumber: 1 });

      expect(getByText('P1 ·hold')).toBeInTheDocument();
      const row = getByText('Vocal Hook 07').closest('button') as HTMLButtonElement;
      expect(row).toBeEnabled();

      fireEvent.click(row);
      expect(onPick).toHaveBeenCalledWith(CLIPS[0]);
    });

    it('disables a clip pending on a DIFFERENT pillar', () => {
      const activeByRfid: ActiveByRfid = {
        'rfid-vox-1': { pillarNumber: 2, state: 'pending' },
      };
      const { getByText } = renderModal({ activeByRfid, pillarNumber: 1 });

      const row = getByText('Vocal Hook 07').closest('button');
      expect(row).toBeDisabled();
      expect(getByText('P2 ·hold')).toBeInTheDocument();
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

  it('calls onPick with the full clip object exactly once when a row is tapped', () => {
    const { getByText, onPick } = renderModal();

    const clipButton = getByText('Vocal Hook 07').closest('button');
    fireEvent.click(clipButton as HTMLButtonElement);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(CLIPS[0]);
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
        onPick={() => {}}
        activeByRfid={{}}
      />,
    );
    rerender(
      <SampleModal
        open
        onClose={() => {}}
        pillarNumber={1}
        clips={CLIPS}
        onPick={() => {}}
        activeByRfid={{}}
      />,
    );

    expect(getByLabelText('Search samples')).toHaveValue('');
    expect(getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});
