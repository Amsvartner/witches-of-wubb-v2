import { useCallback, useEffect, useRef, useState } from 'react';
import { Wordmark } from '~/component/Wordmark';
import { TopControls } from '~/component/TopControls';
import { PillarCardContainer } from '~/container/PillarCardContainer';
import { Cauldron } from '~/component/Cauldron';
import { SettingsBand } from '~/component/SettingsBand';
import { SettingsModal } from '~/component/SettingsModal';
import { Legend } from '~/component/Legend';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { KeyUtil } from '~/util/KeyUtil';
import { LocalStorageUtil } from '~/util/LocalStorageUtil';
import { PillarViewUtil } from '~/util/PillarViewUtil';
import { type SelectableClip } from '~/component/SampleModal';

/** One pending-pick slot per pillar, all unset at mount. */
const NO_PENDING_PICKS: (SelectableClip | null)[] = [null, null, null, null];

/** Legacy TempoSliderContainer bounds — carried over unchanged (WOW-007B). */
const TEMPO_MIN = 75;
const TEMPO_MAX = 155;

/** localStorage keys (WOW-007B persistence) — see LocalStorageUtil. */
const MODE_STORAGE_KEY = 'hexology.mode';
const BASELINE_KEY_STORAGE_KEY = 'hexology.baselineKey';

/**
 * DJ-mode walk-away safeguard (DESIGN_PROPOSAL_001 §6.2): if nobody touches
 * the kiosk while DJ mode is active, it drops back to play mode on its own so
 * the extended controls don't sit exposed indefinitely. 5 minutes is the
 * WOW-007B default — flagged for review.
 */
const DJ_AUTO_EXIT_MS = 5 * 60 * 1000;

type Mode = 'play' | 'dj';

/**
 * Play-mode screen composition (WOW-007B live wiring — supersedes the WOW-007A
 * static spike). Consumes the live Ableton/socket context: pillar view-models
 * are derived from `playingClips`/`queuedClips`/`stoppingClips`/`trackVolume`,
 * tempo/key/volume controls emit onto the frozen socket contract, and DJ mode
 * (toggled via the Settings modal) reveals the extended per-pillar controls
 * that `PillarCardContainer` wires per pillar. Lays out the wireframe-
 * authoritative structure: wordmark + visible Help/Settings/Exit-DJ on top, a
 * 2×2 pillar grid around the central cauldron, then the settings band and
 * legend. Design-first at 1024×1280 (lg); reflows to a single column below
 * that (DESIGN_PROPOSAL_001 §5, responsive behaviour).
 */
export const PlayModeContainer = (): JSX.Element => {
  const socket = useSocketContext();
  const {
    tempo,
    masterKey,
    keylock,
    trackVolume,
    queuedClips,
    playingClips,
    stoppingClips,
    changeTempo,
    changeMasterKey,
    changeKeylock,
  } = useAbletonContext();

  const pillars = PillarViewUtil.derivePillars(
    playingClips,
    queuedClips,
    stoppingClips,
    trackVolume,
  );

  // socket starts out as an unconnected placeholder ({} as Socket, see
  // useSocketContextProviderState) with no .on/.off at all - gate on their
  // presence, not on `.connected`, so a real-but-currently-disconnected
  // socket (e.g. this component happens to (re)run its effect mid-reconnect)
  // still gets its listeners attached immediately, rather than getting
  // treated the same as the placeholder and permanently missing the future
  // 'connect' that would otherwise flip isConnected back (mirrors
  // DebugModalContainer's identical guard — Copilot review, PR #24).
  const [isConnected, setIsConnected] = useState(Boolean(socket.connected));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  // Restores DJ mode across a reload (WOW-007B persistence) — any other
  // stored value (or none) falls back to 'play', the safe default.
  const [mode, setMode] = useState<Mode>(() =>
    LocalStorageUtil.get(MODE_STORAGE_KEY) === 'dj' ? 'dj' : 'play',
  );
  // Pending DJ picks (WOW-007B pending-pick queue): a clip a DJ has chosen
  // from the sample picker but not yet started. Held here (not inside
  // PillarCardContainer) rather than emitted immediately, because the
  // backend starts an idle pillar's clip immediately on `/new/tag` and even
  // a backend-"queued" clip auto-fires at the next phrase boundary (see
  // sim/core/simulator.ts) — so a mere pick can't reach the socket at all.
  // Lifted to this shared parent (rather than local per-card state) so every
  // pillar's SampleModal can build its `activeByRfid` map from every other
  // pillar's pending pick too, not just its own. Deliberately persists across
  // DJ exit/re-entry (human decision — a held pick shouldn't evaporate just
  // because the DJ closed the extended controls).
  const [pendingPicks, setPendingPicks] = useState<(SelectableClip | null)[]>(NO_PENDING_PICKS);

  const handlePendingPickChange = useCallback((index: number, clip: SelectableClip | null) => {
    setPendingPicks((current) => current.map((existing, i) => (i === index ? clip : existing)));
  }, []);

  useEffect(() => {
    setIsConnected(Boolean(socket.connected));
    if (typeof socket.on !== 'function' || typeof socket.off !== 'function') return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Persists the mode on every change (WOW-007B) — including the DJ
  // auto-exit timeout and the explicit EXIT DJ control below, since both
  // just call `setMode`, same as the Settings modal's segmented control.
  useEffect(() => {
    LocalStorageUtil.set(MODE_STORAGE_KEY, mode);
  }, [mode]);

  // DJ auto-exit: resets a 5-minute timer on every pointer interaction while
  // DJ mode is active, and drops back to play mode if the timer expires.
  useEffect(() => {
    if (mode !== 'dj') return undefined;

    let timeoutId: number;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setMode('play'), DJ_AUTO_EXIT_MS);
    };

    resetTimer();
    window.addEventListener('pointerdown', resetTimer);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', resetTimer);
    };
  }, [mode]);

  // Kiosk parity: suppress the context menu everywhere in this screen, ported
  // verbatim from MainScreen's identical effect.
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const tempoSlider = useSliderEmit(tempo, changeTempo);
  const keyQuality = KeyUtil.keyQuality(masterKey);

  // Baseline-key tracking for Reset (WOW-007B, extended for localStorage
  // persistence): the contract has no key-reset event, so Reset re-emits
  // `set_master-key` with the last key the backend set ORGANICALLY (clip
  // placement / phrase-leader), undoing manual Raise/Lower transposition.
  // Organic vs manual is told apart by remembering the value each manual
  // request asked for: a `masterKey` change that doesn't match the last
  // request came from the backend itself and becomes the new baseline
  // (persisted immediately, so it survives a reload).
  //
  // The baseline itself is seeded from storage rather than starting blank,
  // so a page reload mid-show doesn't lose track of pre-reload manual
  // transposition (Reset must still be able to undo it). That means the
  // FIRST masterKey observation after mount can't blindly overwrite the
  // baseline the way every later organic change does — `hasSeenMasterKeyRef`
  // marks that first observation so it can be skipped when a stored baseline
  // already exists; with no stored baseline, it behaves exactly as before
  // (baseline seeds from whatever key is live at mount).
  const lastRequestedKeyRef = useRef<string | null>(null);
  const hasSeenMasterKeyRef = useRef(false);
  const [baselineKey, setBaselineKey] = useState<string>(
    () => LocalStorageUtil.get(BASELINE_KEY_STORAGE_KEY) ?? '',
  );
  useEffect(() => {
    if (!masterKey) return;
    const isFirstObservation = !hasSeenMasterKeyRef.current;
    hasSeenMasterKeyRef.current = true;

    if (isFirstObservation && LocalStorageUtil.get(BASELINE_KEY_STORAGE_KEY)) {
      // A stored baseline survived the reload — trust it over whatever key
      // happens to be live right now (that live key may just be pre-reload
      // manual transposition the DJ hasn't reset yet).
      return;
    }
    if (masterKey !== lastRequestedKeyRef.current) {
      setBaselineKey(masterKey);
      LocalStorageUtil.set(BASELINE_KEY_STORAGE_KEY, masterKey);
    }
  }, [masterKey]);

  const requestKey = (key: string): void => {
    if (!key) return;
    lastRequestedKeyRef.current = key;
    changeMasterKey(key);
  };

  return (
    <div className='mx-auto flex min-h-screen max-w-[1024px] flex-col px-8 py-4'>
      {!isConnected && (
        <div
          role='status'
          aria-live='polite'
          className='mb-2 rounded-md bg-amber-900/40 py-1.5 text-center font-data text-sm text-amber-200'
        >
          Connecting to the cauldron…
        </div>
      )}

      <header>
        <div className='flex justify-end'>
          <TopControls
            onOpenSettings={() => setIsSettingsOpen(true)}
            djActive={mode === 'dj'}
            onExitDj={() => setMode('play')}
          />
        </div>
        {/* Raised into the Help/Settings row so the logo keeps clear air above
            the pillar grid (human, 2026-07-17); no horizontal overlap at 1024. */}
        <div className='-mt-9 flex justify-center pb-1'>
          <Wordmark />
        </div>
      </header>

      <div className='mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_180px_1fr] lg:grid-rows-2'>
        <div className='relative z-10 min-w-0 lg:col-start-1 lg:row-start-1'>
          <PillarCardContainer
            index={0}
            pillar={pillars[0]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
          />
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-3 lg:row-start-1'>
          <PillarCardContainer
            index={1}
            pillar={pillars[1]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
          />
        </div>
        {/* Oversized focal cauldron — deliberately extends behind the pillar
            cards (human, 2026-07-17); cards layer above via z-10. */}
        <div className='relative z-0 flex items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1'>
          <div className='w-full max-w-[320px] lg:absolute lg:left-1/2 lg:top-1/2 lg:w-[405px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2'>
            <Cauldron animated={animationsEnabled} />
          </div>
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-1 lg:row-start-2'>
          <PillarCardContainer
            index={2}
            pillar={pillars[2]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
          />
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-3 lg:row-start-2'>
          <PillarCardContainer
            index={3}
            pillar={pillars[3]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
          />
        </div>
      </div>

      <div className='mt-4'>
        <SettingsBand
          tempoBpm={tempoSlider.value}
          tempoMin={TEMPO_MIN}
          tempoMax={TEMPO_MAX}
          onTempoChange={tempoSlider.onValue}
          onTempoDragStart={tempoSlider.onDragStart}
          onTempoDragEnd={tempoSlider.onDragEnd}
          autoAdjustKey={keylock}
          onAutoAdjustKeyChange={changeKeylock}
          currentKey={masterKey}
          keyQuality={keyQuality}
          onRaiseKey={() => requestKey(KeyUtil.nextKey(masterKey))}
          onLowerKey={() => requestKey(KeyUtil.prevKey(masterKey))}
          onResetKey={() => requestKey(baselineKey)}
          canResetKey={Boolean(baselineKey) && masterKey !== baselineKey}
        />
      </div>

      <div className='mt-2 border-t border-gold-line/20 pt-3'>
        <Legend />
      </div>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={mode}
        onModeChange={setMode}
        animationsEnabled={animationsEnabled}
        onAnimationsEnabledChange={setAnimationsEnabled}
      />
    </div>
  );
};
