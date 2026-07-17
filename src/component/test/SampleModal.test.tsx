import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { ClipTypes } from 'backend/type/ClipTypes';
import { SampleModal, type SelectableClip } from '~/component/SampleModal';

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
      {...overrides}
    />,
  );
  return { ...utils, onClose, onPick };
};

describe('SampleModal (WOW-007B search/filter/sort)', () => {
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

  it('sorts by BPM ascending with missing-bpm clips last', () => {
    const { getByRole, getAllByRole } = renderModal();

    fireEvent.click(getByRole('button', { name: 'BPM' }));

    const orderedNames = getAllByRole('listitem').map((item) => item.textContent);
    expect(orderedNames[0]).toContain('Astral Melody Loop'); // 122
    expect(orderedNames[1]).toContain('Vocal Hook 07'); // 128
    expect(orderedNames[2]).toContain('Basement Growl'); // 140
    expect(orderedNames[3]).toContain('Zephyr Drums'); // no bpm, last
  });

  it('sorts by Key numerically — 2A before 10A, missing key last', () => {
    const { getByRole, getAllByRole } = renderModal();

    fireEvent.click(getByRole('button', { name: 'Key' }));

    const orderedNames = getAllByRole('listitem').map((item) => item.textContent);
    expect(orderedNames[0]).toContain('Basement Growl'); // 2A
    expect(orderedNames[1]).toContain('Vocal Hook 07'); // 4A
    expect(orderedNames[2]).toContain('Astral Melody Loop'); // 10A
    expect(orderedNames[3]).toContain('Zephyr Drums'); // no key, last
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

  it('still calls onPick(rfid) exactly once when a row is tapped', () => {
    const { getByText, onPick } = renderModal();

    const clipButton = getByText('Vocal Hook 07').closest('button');
    fireEvent.click(clipButton as HTMLButtonElement);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('rfid-vox-1');
  });

  it('resets search/filter/sort state when the modal reopens', () => {
    const { getByLabelText, getByRole, rerender } = renderModal();

    fireEvent.change(getByLabelText('Search samples'), { target: { value: 'vocal' } });
    fireEvent.click(getByRole('button', { name: 'Bass' }));
    fireEvent.click(getByRole('button', { name: 'BPM' }));

    rerender(
      <SampleModal
        open={false}
        onClose={() => {}}
        pillarNumber={1}
        clips={CLIPS}
        onPick={() => {}}
      />,
    );
    rerender(
      <SampleModal open onClose={() => {}} pillarNumber={1} clips={CLIPS} onPick={() => {}} />,
    );

    expect(getByLabelText('Search samples')).toHaveValue('');
    expect(getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(getByRole('button', { name: 'Name' })).toHaveAttribute('aria-pressed', 'true');
  });
});
