import { useCallback, useEffect, useRef, useState } from 'react';
import { Wordmark } from '~/component/Wordmark';
import { TopControls } from '~/component/TopControls';
import { PillarCardContainer } from '~/container/PillarCardContainer';
import { Cauldron } from '~/component/Cauldron';
import { SettingsBand } from '~/component/SettingsBand';
import { SettingsModal } from '~/component/SettingsModal';
import { HelpOverlay } from '~/component/HelpOverlay';
import { EmptyStateOverlay } from '~/component/EmptyStateOverlay';
import { Legend } from '~/component/Legend';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { useSliderEmit } from '~/hook/useSliderEmit';
import { KeyUtil } from '~/util/KeyUtil';
import { LocalStorageUtil } from '~/util/LocalStorageUtil';
import { Logger } from '~/util/Logger';
import { PillarViewUtil } from '~/util/PillarViewUtil';
import { type SelectableClip } from '~/component/SampleModal';

/** One pending-picks list per pillar (max 2 each, WOW-007C), all empty at mount. */
const NO_PENDING_PICKS: SelectableClip[][] = [[], [], [], []];

/** Legacy TempoSliderContainer bounds — carried over unchanged (WOW-007B). */
const TEMPO_MIN = 75;
const TEMPO_MAX = 155;

/** localStorage keys (WOW-007B persistence) — see LocalStorageUtil. */
const MODE_STORAGE_KEY = 'hexology.mode';
const BASELINE_KEY_STORAGE_KEY = 'hexology.baselineKey';
/** WOW-007C: persisted DJ auto-exit duration, settable in the Settings modal. */
const DJ_AUTO_EXIT_MS_STORAGE_KEY = 'hexology.djAutoExitMs';

/**
 * DJ-mode walk-away safeguard (DESIGN_PROPOSAL_001 §6.2): if nobody touches
 * the kiosk while DJ mode is active, it drops back to play mode on its own so
 * the extended controls don't sit exposed indefinitely. 5 minutes is the
 * WOW-007B default, now DJ-adjustable via the Settings modal (WOW-007C) and
 * persisted under DJ_AUTO_EXIT_MS_STORAGE_KEY.
 */
const DEFAULT_DJ_AUTO_EXIT_MS = 5 * 60 * 1000;

/** Parses a persisted DJ auto-exit duration, falling back to the default for
 * anything unset, non-numeric, or non-positive (never trust localStorage
 * blindly). Deliberately no upper bound: it's a frontend-only convenience
 * setting (Copilot review, PR #56 — comment now matches the check). */
const parseDjAutoExitMs = (stored: string | null): number => {
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DJ_AUTO_EXIT_MS;
};

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
    triggerCauldronSample,
    cauldronVolume,
    changeCauldronVolume,
    idleTimeout,
    changeIdleTimeout,
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
  // WOW-007D: the Help overlay — forces every pillar's volume tube visible
  // while open (overriding the play-mode empty/queued hiding rule below) and
  // suppresses the all-empty EmptyStateOverlay so the two don't compete for
  // the same screen space.
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  // Restores DJ mode across a reload (WOW-007B persistence) — any other
  // stored value (or none) falls back to 'play', the safe default.
  const [mode, setMode] = useState<Mode>(() =>
    LocalStorageUtil.get(MODE_STORAGE_KEY) === 'dj' ? 'dj' : 'play',
  );
  // Pending DJ picks (WOW-007B pending-pick queue; WOW-007C: up to 2 per
  // pillar, applied from the sample modal's draft): clips a DJ has chosen
  // but not yet started. Held here (not inside PillarCardContainer) rather
  // than emitted immediately, because the backend starts an idle pillar's
  // clip immediately on `/new/tag` and even a backend-"queued" clip
  // auto-fires at the next phrase boundary (see sim/core/simulator.ts) — so
  // a mere pick can't reach the socket at all. Lifted to this shared parent
  // (rather than local per-card state) so every pillar's SampleModal can
  // build its draft baseline from every other pillar's pending picks too,
  // not just its own. Deliberately persists across DJ exit/re-entry (human
  // decision — a held pick shouldn't evaporate just because the DJ closed
  // the extended controls).
  const [pendingPicks, setPendingPicks] = useState<SelectableClip[][]>(NO_PENDING_PICKS);
  // WOW-007C: DJ auto-exit duration, DJ-adjustable via the Settings modal and
  // persisted across reloads — replaces the old fixed DJ_AUTO_EXIT_MS const.
  const [djAutoExitMs, setDjAutoExitMsState] = useState<number>(() =>
    parseDjAutoExitMs(LocalStorageUtil.get(DJ_AUTO_EXIT_MS_STORAGE_KEY)),
  );
  const changeDjAutoExitMs = useCallback((ms: number) => {
    setDjAutoExitMsState(ms);
    LocalStorageUtil.set(DJ_AUTO_EXIT_MS_STORAGE_KEY, String(ms));
  }, []);

  const handlePendingPickChange = useCallback((index: number, picks: SelectableClip[]) => {
    setPendingPicks((current) => current.map((existing, i) => (i === index ? picks : existing)));
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

  // DJ auto-exit: resets a timer (djAutoExitMs, DJ-adjustable) on every
  // pointer interaction while DJ mode is active, and drops back to play mode
  // if the timer expires.
  useEffect(() => {
    if (mode !== 'dj') return undefined;

    let timeoutId: number;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setMode('play'), djAutoExitMs);
    };

    resetTimer();
    window.addEventListener('pointerdown', resetTimer);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', resetTimer);
    };
  }, [mode, djAutoExitMs]);

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

  // WOW-007C: guarded the same way as PillarCardContainer's emitGuarded — a
  // cauldron tap while disconnected logs and no-ops rather than emitting
  // into a dead socket.
  const handleCauldronTrigger = (): void => {
    if (!isConnected) {
      Logger.warn('Ignored cauldron trigger: socket not connected');
      return;
    }
    triggerCauldronSample();
  };

  // WOW-007D: shows the EmptyStateOverlay's "place an ingredient" nudge only
  // when there is truly nothing to see anywhere (every pillar's own status
  // is 'empty' — a queued or playing pillar, even without sound yet reaching
  // the speakers, still means a visitor found their way in), only in play
  // mode (DJ mode has its own extended controls to look at), and never while
  // Help is already occupying the screen with its own overlay.
  const allPillarsEmpty = pillars.every((pillar) => pillar.status === 'empty');
  const showEmptyState = mode === 'play' && !isHelpOpen && allPillarsEmpty;

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
            helpActive={isHelpOpen}
            onToggleHelp={() => setIsHelpOpen((open) => !open)}
          />
        </div>
        {/* Raised into the Help/Settings row so the logo keeps clear air above
            the pillar grid (human, 2026-07-17); no horizontal overlap at 1024. */}
        <div className='-mt-9 flex justify-center pb-1'>
          <Wordmark />
        </div>
      </header>

      <div className='mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_180px_1fr] lg:grid-rows-2'>
        {/* Top-row cards (pillars 1 & 2): z-10 — below the cauldron (z-20),
            per the stacking order the human specified 2026-07-20 (see the
            cauldron comment below for the full z-index map). */}
        <div className='relative z-10 min-w-0 lg:col-start-1 lg:row-start-1'>
          <PillarCardContainer
            index={0}
            pillar={pillars[0]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
            helpActive={isHelpOpen}
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
            helpActive={isHelpOpen}
          />
        </div>
        {/* Oversized focal cauldron, raised ~20% closer to the top of its
            column (lg:top-[30%], was lg:top-1/2 — human, 2026-07-20) so it
            reads less like it's sinking into the settings band below.
            Deliberately overlaps the pillar cards (human, 2026-07-17): its
            wrapper sits at z-20, ABOVE the top-row cards (1 & 2, z-10) but
            BELOW the bottom-row cards (3 & 4, z-30) — the human's spec is
            that its handles overlap the top row but tuck under the bottom
            row. The one-shot click ring can't be capped by this stacking
            context, though: Cauldron portals it straight to document.body at
            z-50 (see Cauldron.tsx) so it always renders in front of every
            card regardless of this z-20. */}
        <div className='relative z-20 flex items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1'>
          <div className='w-full max-w-[320px] lg:absolute lg:left-1/2 lg:top-[30%] lg:w-[405px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2'>
            <Cauldron animated={animationsEnabled} onTrigger={handleCauldronTrigger} />
          </div>
        </div>
        {/* Bottom-row cards (pillars 3 & 4): z-30 — above the cauldron. */}
        <div className='relative z-30 min-w-0 lg:col-start-1 lg:row-start-2'>
          <PillarCardContainer
            index={2}
            pillar={pillars[2]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
            helpActive={isHelpOpen}
          />
        </div>
        <div className='relative z-30 min-w-0 lg:col-start-3 lg:row-start-2'>
          <PillarCardContainer
            index={3}
            pillar={pillars[3]}
            djMode={mode === 'dj'}
            animationsEnabled={animationsEnabled}
            isConnected={isConnected}
            pendingPicks={pendingPicks}
            onPendingPickChange={handlePendingPickChange}
            helpActive={isHelpOpen}
          />
        </div>
      </div>

      {/* All four pillars empty, play mode, Help closed: a non-blocking nudge
          (human spec 2026-07-20) — z-30, same layer as the bottom-row cards
          but painted after them in DOM order so it sits visually on top;
          pointer-events-none (baked into the component) so it can never
          intercept a touch meant for a card or the cauldron beneath it. */}
      {showEmptyState && <EmptyStateOverlay animated={animationsEnabled} />}

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
        djActive={mode === 'dj'}
        onModeChange={setMode}
        animationsEnabled={animationsEnabled}
        onAnimationsEnabledChange={setAnimationsEnabled}
        cauldronVolume={cauldronVolume}
        onCauldronVolumeChange={changeCauldronVolume}
        idleTimeout={idleTimeout}
        onIdleTimeoutChange={changeIdleTimeout}
        djAutoExitMs={djAutoExitMs}
        onDjAutoExitMsChange={changeDjAutoExitMs}
      />

      <HelpOverlay open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
