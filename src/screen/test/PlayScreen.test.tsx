import { act, fireEvent, render } from '@testing-library/react';
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
  setDjMode: vi.fn(),
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

  describe('WOW-007D: Help overlay', () => {
    it('toggles the Help button pressed state and opens/closes the overlay', () => {
      const { getByRole, queryByRole } = renderPlayScreen();
      // Keep this one reference and click/assert on it directly throughout —
      // once the overlay opens, Headless UI's Dialog marks the rest of the
      // page inert (aria-hidden) for focus containment, which would drop the
      // button out of a fresh `getByRole` query (same pattern as
      // MainScreen's debug modal). A direct DOM reference sidesteps that.
      const helpButton = getByRole('button', { name: 'HELP' });
      expect(helpButton).toHaveAttribute('aria-pressed', 'false');
      expect(queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();

      fireEvent.click(helpButton);

      expect(helpButton).toHaveAttribute('aria-pressed', 'true');
      expect(getByRole('dialog', { name: 'Help' })).toBeInTheDocument();

      fireEvent.click(helpButton);

      expect(helpButton).toHaveAttribute('aria-pressed', 'false');
      expect(queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    });

    it('renders its callout copy once open', () => {
      const { getByRole, getByText } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: 'HELP' }));

      expect(
        getByText('Tap the cauldron — it loves attention (and makes noises)'),
      ).toBeInTheDocument();
      expect(getByText('Deeper magicks hide behind the Settings sigil')).toBeInTheDocument();
    });

    it('closes via Escape', () => {
      const { getByRole, queryByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: 'HELP' }));
      expect(getByRole('dialog', { name: 'Help' })).toBeInTheDocument();

      fireEvent.keyDown(getByRole('dialog', { name: 'Help' }), { key: 'Escape' });

      expect(queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    });

    it('closes via the explicit ✕ close button', () => {
      const { getByRole, queryByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: 'HELP' }));
      fireEvent.click(getByRole('button', { name: 'Close help' }));

      expect(queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    });

    it('closes via tapping the scrim', () => {
      const { getByRole, getByTestId, queryByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: 'HELP' }));
      fireEvent.click(getByTestId('help-scrim'));

      expect(queryByRole('dialog', { name: 'Help' })).not.toBeInTheDocument();
    });

    it('forces every otherwise-hidden volume tube visible while Help is open', () => {
      // Default fixture: pillar 1 plays (tube always visible), pillar 2 is
      // queued, pillars 3 & 4 are empty — the latter three all hide their
      // tube in plain play mode (WOW-007D hiding rule: nothing audible yet)
      // but must stay pointed-at while Help is open. The two empty pillars'
      // tubes render display-only (no assetSlug, no DJ handler) — queried by
      // their empty-tube art asset rather than role, since a display-only
      // tube exposes no accessible role/name.
      const { getByRole, getAllByRole, container } = renderPlayScreen();
      const emptyTubeImages = () =>
        container.querySelectorAll('img[src="/images/slider-background-empty.png"]');

      // Only the playing pillar's tube is interactive before Help opens; the
      // queued and both empty pillars' tubes are hidden entirely.
      expect(getAllByRole('slider', { name: 'Volume' })).toHaveLength(1);
      expect(emptyTubeImages()).toHaveLength(0);

      fireEvent.click(getByRole('button', { name: 'HELP' }));

      // The queued pillar's tube becomes visible and interactive (it was
      // already handler-eligible, just hidden); both empty pillars' tubes
      // become visible too, display-only. `hidden: true`: the open Help
      // overlay marks the rest of the page inert (Headless UI's focus
      // containment, same as MainScreen's debug modal) — expected while a
      // full-screen dialog is up, and orthogonal to whether the tubes
      // themselves are rendered, which is what this test is actually about.
      expect(getAllByRole('slider', { name: 'Volume', hidden: true })).toHaveLength(2);
      expect(emptyTubeImages()).toHaveLength(2);
    });
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

  it('switches to DJ mode: per-pillar sample selection and queue sections appear (no EXIT DJ button — Settings is the only mode switch, human 2026-07-21)', () => {
    const { getByRole, getAllByRole, getByText, queryByRole } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    fireEvent.click(getByRole('button', { name: 'DJ' }));
    fireEvent.click(getByRole('button', { name: /close/i }));

    expect(queryByRole('button', { name: 'EXIT DJ' })).not.toBeInTheDocument();
    // Select sample renders on every pillar, including empty ones (a DJ must
    // be able to place a first clip on an empty pillar).
    expect(getAllByRole('button', { name: 'Select sample' })).toHaveLength(4);
    // The queue section itself stays gated on a real category: pillar 1
    // (playing, no queue) shows the empty state; pillar 2 (queued) shows its
    // own queued sample as a row.
    expect(getByText('Queue empty')).toBeInTheDocument();
    expect(getByText('Melody Loop')).toBeInTheDocument();
  });

  it('exiting DJ mode via Settings -> Play hides the DJ controls', () => {
    const { getByRole, getAllByRole, queryAllByRole } = renderPlayScreen();

    fireEvent.click(getByRole('button', { name: /settings/i }));
    fireEvent.click(getByRole('button', { name: 'DJ' }));
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(getAllByRole('button', { name: 'Select sample' })).toHaveLength(4);

    fireEvent.click(getByRole('button', { name: /settings/i }));
    fireEvent.click(getByRole('button', { name: 'Play' }));
    fireEvent.click(getByRole('button', { name: /close/i }));

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

      const { getAllByRole } = renderPlayScreen();

      expect(getAllByRole('button', { name: 'Select sample' })).toHaveLength(4);
    });

    it('falls back to play mode when hexology.mode holds anything other than "dj"', () => {
      window.localStorage.setItem('hexology.mode', 'bogus');

      const { queryAllByRole } = renderPlayScreen();

      expect(queryAllByRole('button', { name: 'Select sample' })).toHaveLength(0);
    });

    it('persists the mode to localStorage on every change, in both directions', () => {
      const { getByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
      expect(window.localStorage.getItem('hexology.mode')).toBe('dj');

      fireEvent.click(getByRole('button', { name: 'Play' }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      expect(window.localStorage.getItem('hexology.mode')).toBe('play');
    });
  });

  // WOW-007C item 4: the idle timeout must never hand over to the Live-set
  // attractor while DJ mode is active — PlayModeContainer tells the backend
  // via setDjMode on every mode change and on every (re)connect (backend
  // state isn't persisted, see AbletonAdapter.djModeActive).
  describe('WOW-007C item 4: DJ-mode idle-timeout suppression (setDjMode)', () => {
    it('calls setDjMode(true) on switching to DJ mode, and setDjMode(false) back to Play, while connected', () => {
      const { getByRole, abletonState } = renderPlayScreen({ socket: createSocket(true) });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));

      expect(abletonState.setDjMode).toHaveBeenLastCalledWith(true);

      fireEvent.click(getByRole('button', { name: 'Play' }));

      // Same setMode plumbing the DJ auto-exit walk-away timer uses
      // (PlayModeContainer's setTimeout(() => setMode('play'), djAutoExitMs))
      // — restoring the idle timeout on auto-exit is this exact chain, not a
      // separate mechanism.
      expect(abletonState.setDjMode).toHaveBeenLastCalledWith(false);
    });

    it('does not call setDjMode while the socket has never connected', () => {
      const { getByRole, abletonState } = renderPlayScreen({ socket: createSocket(false) });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));

      expect(abletonState.setDjMode).not.toHaveBeenCalled();
    });

    it('re-asserts the current mode on reconnect, since backend-side DJ state is not persisted', () => {
      const handlers: Record<string, () => void> = {};
      const socket = {
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb;
        }),
        off: vi.fn(),
        emit: vi.fn(),
        connected: false,
      } as unknown as Socket;

      const { getByRole, abletonState } = renderPlayScreen({ socket });

      // Switched to DJ mode entirely before the backend ever connects.
      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
      fireEvent.click(getByRole('button', { name: /close/i }));
      expect(abletonState.setDjMode).not.toHaveBeenCalled();

      // The backend connects — a fresh backend process has djModeActive
      // false by default (failsafe posture), so it must be told the UI's
      // actual current mode, not just future changes.
      act(() => {
        handlers.connect?.();
      });

      expect(abletonState.setDjMode).toHaveBeenCalledWith(true);
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

  // WOW-007D: cauldron raised + re-stacked so its wrapper sits above the
  // top-row cards but below the bottom-row cards (human spec 2026-07-20).
  // Deliberately light — asserting the z-index classes exist on the right
  // ancestors, not the full Tailwind class string.
  describe('WOW-007D: pillar/cauldron z-order', () => {
    it('places the cauldron wrapper behind every pillar card (its art has an opaque background — human, 2026-07-21)', () => {
      const { getByRole, getAllByText } = renderPlayScreen();

      const cauldronWrapper = getByRole('button', { name: 'Cauldron' }).closest('.z-0');
      expect(cauldronWrapper).not.toBeNull();

      // Pillar 1 (VOCALS) is top row; pillars 3 & 4 ("awaiting ingredient",
      // both empty in the default fixture) are bottom row — all four at z-10.
      const topRowWrapper = getByRole('heading', { level: 2, name: 'VOCALS' }).closest('.z-10');
      expect(topRowWrapper).not.toBeNull();

      const bottomRowWrapper = getAllByText(/awaiting ingredient/i)[0].closest('.z-10');
      expect(bottomRowWrapper).not.toBeNull();
    });
  });

  // WOW-007D: the "place an ingredient" nudge, shown only when the whole
  // board has nothing going on.
  describe('WOW-007D: EmptyStateOverlay', () => {
    const allEmptyState = () =>
      createAbletonState({
        playingClips: [null, null, null, null],
        queuedClips: [null, null, null, null],
        stoppingClips: [null, null, null, null],
      });

    it('appears when every pillar is empty in play mode', () => {
      const { getByText } = renderPlayScreen({ abletonState: allEmptyState() });

      expect(
        getByText(/place an ingredient upon a pillar to begin the spell/i),
      ).toBeInTheDocument();
    });

    it('is absent when the default fixture has active/queued pillars', () => {
      const { queryByText } = renderPlayScreen();

      expect(
        queryByText(/place an ingredient upon a pillar to begin the spell/i),
      ).not.toBeInTheDocument();
    });

    it('is absent in DJ mode even with every pillar empty', () => {
      const { getByRole, queryByText } = renderPlayScreen({ abletonState: allEmptyState() });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
      fireEvent.click(getByRole('button', { name: /close/i }));

      expect(
        queryByText(/place an ingredient upon a pillar to begin the spell/i),
      ).not.toBeInTheDocument();
    });

    it('is absent while Help is open even with every pillar empty', () => {
      const { getByRole, queryByText } = renderPlayScreen({ abletonState: allEmptyState() });

      fireEvent.click(getByRole('button', { name: 'HELP' }));

      expect(
        queryByText(/place an ingredient upon a pillar to begin the spell/i),
      ).not.toBeInTheDocument();
    });

    it('is pointer-events-none so it never blocks the pillars/cauldron beneath it', () => {
      const { getByText } = renderPlayScreen({ abletonState: allEmptyState() });

      const overlayText = getByText(/place an ingredient upon a pillar to begin the spell/i);
      const overlayRoot = overlayText.closest('.pointer-events-none');

      expect(overlayRoot).not.toBeNull();
    });
  });

  describe('WOW-007C: Settings modal — cauldron loudness, pause music, DJ auto-exit', () => {
    // The three sections are DJ-gated (human safety decision 2026-07-20):
    // visitors in play mode only get Mode + Animations, so every test below
    // switches to DJ mode inside the open Settings modal first.
    it('hides the cauldron loudness, pause music, and DJ auto-exit sections in play mode', () => {
      const { getByRole, queryByText, queryByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));

      expect(queryByText('Cauldron loudness')).not.toBeInTheDocument();
      expect(queryByRole('slider', { name: 'Cauldron loudness' })).not.toBeInTheDocument();
      expect(queryByText('Pause music')).not.toBeInTheDocument();
      expect(queryByText('DJ auto-exit')).not.toBeInTheDocument();
    });

    it('reveals the three sections as soon as DJ mode is switched on inside the modal', () => {
      const { getByRole, getByText } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));

      expect(getByText('Cauldron loudness')).toBeInTheDocument();
      expect(getByText('Pause music')).toBeInTheDocument();
      expect(getByText('DJ auto-exit')).toBeInTheDocument();
    });

    it('renders the cauldron loudness slider at the fixture value and emits the mapped raw volume on change', () => {
      // 0.35 / 0.7 ceiling = 50%
      const { getByRole, abletonState } = renderPlayScreen({
        abletonState: createAbletonState({ cauldronVolume: 0.35 }),
      });

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
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
      fireEvent.click(getByRole('button', { name: 'DJ' }));
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
      fireEvent.click(getByRole('button', { name: 'DJ' }));
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
      fireEvent.click(getByRole('button', { name: 'DJ' }));

      expect(getByRole('button', { name: 'Pause music after 1 min' })).toBeDisabled();
    });

    it('persists a picked DJ auto-exit duration to localStorage and marks it pressed', () => {
      const { getByRole } = renderPlayScreen();

      fireEvent.click(getByRole('button', { name: /settings/i }));
      fireEvent.click(getByRole('button', { name: 'DJ' }));
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
      // Restore DJ mode too — the section only renders for a DJ.
      window.localStorage.setItem('hexology.mode', 'dj');

      const { getByRole } = renderPlayScreen();
      fireEvent.click(getByRole('button', { name: /settings/i }));

      expect(getByRole('button', { name: 'DJ auto-exit after 30 min' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
