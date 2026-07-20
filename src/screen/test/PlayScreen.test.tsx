import { fireEvent, render } from '@testing-library/react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PlayScreen } from '~/screen/PlayScreen';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';
import { KeyUtil } from '~/util/KeyUtil';

// jsdom doesn't implement ResizeObserver, which @headlessui/react's Dialog
// uses internally (same stub pattern as DebugModalContainer.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const clipFixture = (pillar: number, clipName: string, type: ClipTypes): BrowserClipInfo => ({
  pillar,
  rfid: `rfid-${pillar}`,
  clipName,
  type,
  assetName: `${type}.png`,
});

const createAbletonState = (overrides: Partial<AbletonContextState> = {}): AbletonContextState => ({
  tempo: 130,
  masterKey: '8A',
  keylock: true,
  trackVolume: [0.42, 0, 0, 0],
  // Pillar 1 (index 0): playing Vox. Pillar 2 (index 1): queued Melody.
  // Pillars 3 & 4 stay empty ("awaiting ingredient").
  playingClips: [clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox), null, null, null],
  queuedClips: [null, clipFixture(1, 'Melody Loop', ClipTypes.Melody), null, null],
  stoppingClips: [null, null, null, null],
  clipTempo: [null, null, null, null],
  changeTempo: vi.fn(),
  changeTrackVolume: vi.fn(),
  changeMasterKey: vi.fn(),
  changeKeylock: vi.fn(),
  getTracksAndClips: vi.fn(),
  // WOW-007C
  triggerCauldronSample: vi.fn(),
  cauldronVolume: 0.6,
  changeCauldronVolume: vi.fn(),
  idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
  changeIdleTimeout: vi.fn(),
  ...overrides,
});

const createSocket = (connected: boolean): Socket =>
  ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected } as unknown as Socket);

function renderPlayScreen(options: { abletonState?: AbletonContextState; socket?: Socket } = {}) {
  const abletonState = options.abletonState ?? createAbletonState();
  const socket = options.socket ?? createSocket(true);
  const utils = render(
    <SocketContext.Provider value={socket}>
      <AbletonContext.Provider value={abletonState}>
        <PlayScreen />
      </AbletonContext.Provider>
    </SocketContext.Provider>,
  );
  return { ...utils, abletonState, socket };
}

describe('PlayScreen (WOW-007B live wiring)', () => {
  // Mode and baseline-key both initialise from localStorage (WOW-007B
  // persistence) — clear it before and after every test in this file so no
  // test leaks a stored value into another.
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the ceremonial wordmark as the single h1', () => {
    const { getByRole } = renderPlayScreen();
    expect(getByRole('heading', { level: 1, name: 'HEXOLOGY' })).toBeInTheDocument();
  });

  it('derives the four pillars from the live context state', () => {
    const { getByRole, getByText, getAllByText } = renderPlayScreen();

    expect(getByRole('heading', { level: 2, name: 'VOCALS' })).toBeInTheDocument();
    expect(getByText('PLAYING')).toBeInTheDocument();

    expect(getByRole('heading', { level: 2, name: 'MELODY' })).toBeInTheDocument();
    expect(getByText('QUEUED')).toBeInTheDocument();

    // Pillars 3 and 4 have no clips at all.
    expect(getAllByText(/awaiting ingredient/i)).toHaveLength(2);
  });

  it('exposes a disabled Help affordance', () => {
    const { getByRole } = renderPlayScreen();
    expect(getByRole('button', { name: /help/i })).toBeDisabled();
  });

  it('opens the Settings modal with a Play/DJ segmented control and an enabled Animations toggle', () => {
    const { getByRole, queryByRole } = renderPlayScreen();
    expect(queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    expect(getByRole('dialog')).toBeInTheDocument();

    const playButton = getByRole('button', { name: 'Play' });
    const djButton = getByRole('button', { name: 'DJ' });
    expect(playButton).toHaveAttribute('aria-pressed', 'true');
    expect(djButton).toHaveAttribute('aria-pressed', 'false');

    const animationsToggle = getByRole('button', { name: 'Animations' });
    expect(animationsToggle).toBeEnabled();
    expect(animationsToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches to DJ mode: EXIT DJ appears, per-pillar sample selection and queue sections appear', () => {
    const { getByRole, getAllByRole, getByText } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    fireEvent.click(getByRole('button', { name: 'DJ' }));
    fireEvent.click(getByRole('button', { name: /close/i }));

    expect(getByRole('button', { name: 'EXIT DJ' })).toBeInTheDocument();
    // Select sample renders on every pillar, including empty ones (a DJ must
    // be able to place a first clip on an empty pillar).
    expect(getAllByRole('button', { name: 'Select sample' })).toHaveLength(4);
    // The queue section itself stays gated on a real category: pillar 1
    // (playing, no queue) shows the empty state; pillar 2 (queued) shows its
    // own queued sample as a row.
    expect(getByText('Queue empty')).toBeInTheDocument();
    expect(getByText('Melody Loop')).toBeInTheDocument();
  });

  it('exiting DJ mode returns to play mode and hides the DJ controls', () => {
    const { getByRole, queryByRole, queryAllByRole } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    fireEvent.click(getByRole('button', { name: 'DJ' }));
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(getByRole('button', { name: 'EXIT DJ' })).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'EXIT DJ' }));

    expect(queryByRole('button', { name: 'EXIT DJ' })).not.toBeInTheDocument();
    expect(queryAllByRole('button', { name: 'Select sample' })).toHaveLength(0);
  });

  it('shows the fixture tempo in the settings band', () => {
    const { getByText } = renderPlayScreen();
    expect(getByText('130')).toBeInTheDocument();
  });

  it('raises the master key via KeyUtil.nextKey when Raise is clicked', () => {
    const { getByRole, abletonState } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: 'Raise key' }));

    expect(abletonState.changeMasterKey).toHaveBeenCalledWith(KeyUtil.nextKey('8A'));
  });

  it('lowers the master key via KeyUtil.prevKey when Lower is clicked', () => {
    const { getByRole, abletonState } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: 'Lower key' }));

    expect(abletonState.changeMasterKey).toHaveBeenCalledWith(KeyUtil.prevKey('8A'));
  });

  it('toggles auto-adjust key onto changeKeylock', () => {
    const { getByRole, abletonState } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: 'Auto-adjust key' }));

    expect(abletonState.changeKeylock).toHaveBeenCalledWith(false);
  });

  it('shows a connecting banner when the socket is disconnected', () => {
    const { getByText } = renderPlayScreen({ socket: createSocket(false) });
    expect(getByText(/connecting to the cauldron/i)).toBeInTheDocument();
  });

  it('hides the connecting banner once connected', () => {
    const { queryByText } = renderPlayScreen({ socket: createSocket(true) });
    expect(queryByText(/connecting to the cauldron/i)).not.toBeInTheDocument();
  });

  it('resets the key to the tracked baseline, undoing manual transposition', () => {
    const abletonState = createAbletonState(); // masterKey '8A' — becomes the baseline
    const socket = createSocket(true);
    const ui = (state: AbletonContextState) => (
      <SocketContext.Provider value={socket}>
        <AbletonContext.Provider value={state}>
          <PlayScreen />
        </AbletonContext.Provider>
      </SocketContext.Provider>
    );
    const { getByRole, rerender } = render(ui(abletonState));

    // At the baseline: nothing to undo.
    expect(getByRole('button', { name: 'Reset key' })).toBeDisabled();

    // Manual raise requests 8B; the backend echoes it back as masterKey.
    fireEvent.click(getByRole('button', { name: 'Raise key' }));
    expect(abletonState.changeMasterKey).toHaveBeenCalledWith(KeyUtil.nextKey('8A'));
    rerender(ui({ ...abletonState, masterKey: KeyUtil.nextKey('8A') }));

    // The echo of a manual request must NOT move the baseline — Reset is now
    // live and re-emits the original organic key.
    const reset = getByRole('button', { name: 'Reset key' });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(abletonState.changeMasterKey).toHaveBeenLastCalledWith('8A');

    // An ORGANIC key change (differs from the last manual request) becomes
    // the new baseline — Reset disables again at the new baseline.
    rerender(ui({ ...abletonState, masterKey: '5A' }));
    expect(getByRole('button', { name: 'Reset key' })).toBeDisabled();
  });

  describe('mode persistence (WOW-007B localStorage)', () => {
    it('restores DJ mode on mount from a stored hexology.mode, without opening Settings', () => {
      window.localStorage.setItem('hexology.mode', 'dj');

      const { getByRole } = renderPlayScreen();

      expect(getByRole('button', { name: 'EXIT DJ' })).toBeInTheDocument();
    });

    it('falls back to play mode when hexology.mode holds anything other than "dj"', () => {
      window.localStorage.setItem('hexology.mode', 'bogus');

      const { queryByRole } = renderPlayScreen();

      expect(queryByRole('button', { name: 'EXIT DJ' })).not.toBeInTheDocument();
    });

    it('persists the mode to localStorage on every change, including EXIT DJ', () => {
      const { getByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      expect(window.localStorage.getItem('hexology.mode')).toBe('dj');

      fireEvent.click(getByRole('button', { name: 'EXIT DJ' }));
      expect(window.localStorage.getItem('hexology.mode')).toBe('play');
    });
  });

  describe('baseline key persistence (WOW-007B localStorage)', () => {
    it('initialises the baseline from a stored key, enabling Reset immediately when it differs from the live master key', () => {
      window.localStorage.setItem('hexology.baselineKey', '7A');
      // Fixture masterKey is '8A' — differs from the stored baseline, so
      // Reset must already be usable before any interaction happens.
      const { getByRole, abletonState } = renderPlayScreen();

      const reset = getByRole('button', { name: 'Reset key' });
      expect(reset).toBeEnabled();

      fireEvent.click(reset);
      expect(abletonState.changeMasterKey).toHaveBeenCalledWith('7A');
    });

    it('does not overwrite a stored baseline with whatever key happens to be live at mount', () => {
      window.localStorage.setItem('hexology.baselineKey', '7A');

      renderPlayScreen();

      // The mount-time masterKey ('8A') must not have clobbered storage.
      expect(window.localStorage.getItem('hexology.baselineKey')).toBe('7A');
    });

    it('persists the baseline whenever an organic key change updates it', () => {
      const abletonState = createAbletonState();
      const socket = createSocket(true);
      const ui = (state: AbletonContextState) => (
        <SocketContext.Provider value={socket}>
          <AbletonContext.Provider value={state}>
            <PlayScreen />
          </AbletonContext.Provider>
        </SocketContext.Provider>
      );
      const { rerender } = render(ui(abletonState));

      // Mount itself is the first (organic) observation with no stored
      // baseline yet, so it persists '8A'.
      expect(window.localStorage.getItem('hexology.baselineKey')).toBe('8A');

      // A later organic change persists the new value too.
      rerender(ui({ ...abletonState, masterKey: '5A' }));
      expect(window.localStorage.getItem('hexology.baselineKey')).toBe('5A');
    });
  });

  describe('WOW-007C: cauldron sample trigger', () => {
    it('tapping the cauldron calls triggerCauldronSample when connected', () => {
      const { getByRole, abletonState } = renderPlayScreen({ socket: createSocket(true) });

      fireEvent.click(getByRole('button', { name: 'Cauldron' }));

      expect(abletonState.triggerCauldronSample).toHaveBeenCalledTimes(1);
    });

    it('does not call triggerCauldronSample while disconnected (guarded, same as pillar volume)', () => {
      const { getByRole, abletonState } = renderPlayScreen({ socket: createSocket(false) });

      fireEvent.click(getByRole('button', { name: 'Cauldron' }));

      expect(abletonState.triggerCauldronSample).not.toHaveBeenCalled();
    });
  });

  describe('WOW-007C: Settings modal — cauldron loudness, pause music, DJ auto-exit', () => {
    it('renders the cauldron loudness slider at the fixture value and emits the mapped raw volume on change', () => {
      // 0.35 / 0.7 ceiling = 50%
      const { getByRole, abletonState } = renderPlayScreen({
        abletonState: createAbletonState({ cauldronVolume: 0.35 }),
      });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      const slider = getByRole('slider', { name: 'Cauldron loudness' });
      expect(slider).toHaveValue('50');

      fireEvent.change(slider, { target: { value: '80' } });

      // Floating-point: 80% of 0.7 is 0.56, but the percent<->raw round trip
      // isn't exact in JS float arithmetic.
      expect(abletonState.changeCauldronVolume).toHaveBeenCalledTimes(1);
      expect(vi.mocked(abletonState.changeCauldronVolume).mock.calls[0][0]).toBeCloseTo(0.56);
    });

    it('toggles pause music via changeIdleTimeout, preserving the current timeoutMs', () => {
      const { getByRole, abletonState } = renderPlayScreen({
        abletonState: createAbletonState({
          idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
        }),
      });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'Pause music' }));

      expect(abletonState.changeIdleTimeout).toHaveBeenCalledWith({
        enabled: false,
        timeoutMs: 3 * 60 * 1000,
      });
    });

    it('picking a pause-music minutes choice calls changeIdleTimeout with the new duration', () => {
      const { getByRole, abletonState } = renderPlayScreen({
        abletonState: createAbletonState({
          idleTimeout: { enabled: true, timeoutMs: 3 * 60 * 1000 },
        }),
      });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'Pause music after 5 min' }));

      expect(abletonState.changeIdleTimeout).toHaveBeenCalledWith({
        enabled: true,
        timeoutMs: 5 * 60 * 1000,
      });
    });

    it('disables the pause-music minutes buttons when the toggle is off', () => {
      const { getByRole } = renderPlayScreen({
        abletonState: createAbletonState({ idleTimeout: { enabled: false, timeoutMs: 60000 } }),
      });

      fireEvent.click(getByRole('button', { name: /settings/i }));

      expect(getByRole('button', { name: 'Pause music after 1 min' })).toBeDisabled();
    });

    it('persists a picked DJ auto-exit duration to localStorage and marks it pressed', () => {
      const { getByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));
      // Default is 5 min (DEFAULT_DJ_AUTO_EXIT_MS) — pick a different one.
      fireEvent.click(getByRole('button', { name: 'DJ auto-exit after 10 min' }));

      expect(window.localStorage.getItem('hexology.djAutoExitMs')).toBe(String(10 * 60 * 1000));
      expect(getByRole('button', { name: 'DJ auto-exit after 10 min' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('restores a persisted DJ auto-exit duration on mount', () => {
      window.localStorage.setItem('hexology.djAutoExitMs', String(30 * 60 * 1000));

      const { getByRole } = renderPlayScreen();
      fireEvent.click(getByRole('button', { name: /settings/i }));

      expect(getByRole('button', { name: 'DJ auto-exit after 30 min' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
