/**
 * Fake backend state machine mirroring the browser-observable behavior of the
 * real backend (backend/event/IncomingEvents.ts + backend/adapter/AbletonAdapter.ts).
 * Transport-free per ADR-001: no socket.io imports; `sim/server.ts` binds this
 * to a socket, and vitest exercises it directly.
 *
 * Known approximations (documented in the WOW-003 handoff note):
 * - Clip triggering is synchronous. The real backend fires clips through
 *   Ableton quantization, so `clip_started` arrives after a beat-aligned
 *   delay; event names/shapes/order are identical.
 * - Queued clips trigger on a fixed timer (`phraseLengthMs`) instead of the
 *   phrase leader's loop end, which is only knowable from the live set.
 * - `clip_started` bpm comes from the CSV BPM column instead of Ableton warp
 *   markers (backend/adapter/AbletonAdapter.ts:405).
 * - The real backend's missing-clip branch (backend/adapter/AbletonAdapter.ts:172-178:
 *   `clip_unqueued` when a CSV clip has no matching clip in the live Ableton
 *   set) is not modeled — the sim has no live set, so every database clip
 *   "exists". Shapes and acks are unaffected.
 */
import { MusicDatabase, getPillarIPAddressFromIndex } from './music-database';
import {
  BrowserClipInfo,
  BrowserClipInfoList,
  IdleTimeoutConfigType,
  SetCauldronVolumeInputType,
  SetTrackVolumeInputType,
  SimEventListener,
  TagDetectionData,
  TrackVolumesType,
} from './types';

// Mirror TIMEOUT_IN_MILISECONDS / TIMEOUT_WARNING_IN_MILISECONDS
// (backend/adapter/AbletonAdapter.ts:24-25)
export const TIMEOUT_IN_MILISECONDS = 60 * 3 * 1000;
export const TIMEOUT_WARNING_IN_MILISECONDS = 30 * 1000;
// WOW-007C: mirrors MIN_IDLE_TIMEOUT_MS / MAX_IDLE_TIMEOUT_MS
// (backend/adapter/AbletonAdapter.ts) — bounds accepted by setIdleTimeoutConfig.
// The minimum sits ABOVE the warning offset so the warning timer can never
// arm with a zero/negative delay (audio-ableton review, PR #56).
export const MIN_IDLE_TIMEOUT_MS = 60 * 1000;
export const MAX_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

const PILLAR_COUNT = 4;

// WOW-007C: mirrors PILLAR_VOLUME_CEILING / clampVolume
// (backend/adapter/AbletonAdapter.ts) — same 0..0.7 ceiling, applied to BOTH
// the cauldron (drum-rack track) volume and regular pillar volumes: the
// backend now clamps pillar volumes too, so the sim's volume_changed echoes
// must never carry a value the real backend couldn't emit (general review,
// PR #56).
const VOLUME_CEILING = 0.7;
const clampVolume = (volume: number): number => {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(VOLUME_CEILING, Math.max(0, volume));
};
const clampCauldronVolume = clampVolume;

// WOW-007C: deterministic stand-in for a randomly-picked drum-rack clip name
// — the sim has no Live set / drum rack to pick from, so every cauldron tap
// reports the same clip name (shapes and acks are unaffected).
const SIM_CAULDRON_CLIP_NAME = 'Sim Drum Hit';

export type SimulatorLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type SimulatorOptions = {
  database: MusicDatabase;
  /** Sim-only defaults; the real values come from the live Ableton set. */
  initialTempo?: number;
  initialTrackVolumes?: TrackVolumesType;
  /** Stand-in for the phrase leader's loop length (see header comment). */
  phraseLengthMs?: number;
  timeoutMs?: number;
  timeoutWarningMs?: number;
  logger?: SimulatorLogger;
};

// Playing/queued slots hold full metadata; the get_*_clips acks project a
// subset of these fields (see toBrowserClipInfoList).
type ClipSlot = BrowserClipInfo | null;

// Mirrors ClipNameUtil.normalizeClipName (backend/util/ClipNameUtil.ts): strip
// asterisks and ALL whitespace (tab/NBSP/BOM too), and keep the two in sync.
const normalizeClipName = (clipName: string) => clipName.replace(/[*\s]/g, '');

const positiveOrDefault = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

// The real backend derives the pillar from the RFID reader's source IP, so it
// can never see an out-of-range index; a websocket client can send anything.
// Guard so bad input can't stretch the fixed 4-slot state arrays and break
// the BrowserClipInfoList/TrackVolumesType ack shapes.
const isValidPillar = (pillar: number) =>
  Number.isInteger(pillar) && pillar >= 0 && pillar < PILLAR_COUNT;

export class Simulator {
  private readonly database: MusicDatabase;
  private readonly logger: SimulatorLogger;
  private readonly listeners: SimEventListener[] = [];
  private readonly phraseLengthMs: number;
  // WOW-007C: mutable (was readonly) — setIdleTimeoutConfig re-arms the
  // running timer against a new value, mirroring the backend's
  // `let idleTimeoutMs` (AbletonAdapter.ts).
  private timeoutMs: number;
  private readonly timeoutWarningMs: number;

  private tempo: number;
  private trackVolumes: TrackVolumesType;
  private keyLockEnabled = true; // mirrors backend/adapter/AbletonAdapter.ts:36
  private masterKey = ''; // mirrors backend/adapter/AbletonAdapter.ts:37
  private playingClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);
  private queuedClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);
  private stoppingClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);
  // WOW-007C: mirrors idleTimeoutEnabled (backend/adapter/AbletonAdapter.ts)
  // — disabling means spells loop indefinitely and the Live-set attractor
  // never engages (see restartTimeoutTimer).
  private idleTimeoutEnabled = true;
  // WOW-007C: mirrors cauldronVolumeParam's resolved value
  // (backend/adapter/AbletonAdapter.ts getCauldronVolume) — same 0.6 default.
  private cauldronVolume = 0.6;
  // WOW-007C: mirrors desiredVolumes (backend/adapter/AbletonAdapter.ts) — the
  // last volume a caller explicitly asked for on each pillar, so a new clip
  // starting there restores it instead of always slamming a hardcoded 0.6
  // (see setTrackVolume / startClip). null = never explicitly set.
  private desiredVolumes: (number | null)[] = new Array(PILLAR_COUNT).fill(null);

  private phraseTimerId: ReturnType<typeof setTimeout> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private timeoutWarningId: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SimulatorOptions) {
    this.database = options.database;
    this.logger = options.logger ?? console;
    this.tempo = options.initialTempo ?? 120;
    this.trackVolumes = options.initialTrackVolumes ?? new Array(PILLAR_COUNT).fill(0.6);
    this.phraseLengthMs = positiveOrDefault(options.phraseLengthMs, 8000);
    this.timeoutMs = positiveOrDefault(options.timeoutMs, TIMEOUT_IN_MILISECONDS);
    this.timeoutWarningMs = positiveOrDefault(
      options.timeoutWarningMs,
      TIMEOUT_WARNING_IN_MILISECONDS,
    );
    if (this.timeoutWarningMs >= this.timeoutMs) {
      this.logger.warn(
        `timeoutWarningMs (${this.timeoutWarningMs}) must be smaller than timeoutMs (${this.timeoutMs}) — using defaults`,
      );
      this.timeoutMs = TIMEOUT_IN_MILISECONDS;
      this.timeoutWarningMs = TIMEOUT_WARNING_IN_MILISECONDS;
    }
  }

  onEvent(listener: SimEventListener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  dispose() {
    if (this.phraseTimerId) clearTimeout(this.phraseTimerId);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.timeoutWarningId) clearTimeout(this.timeoutWarningId);
    this.phraseTimerId = null;
    this.timeoutId = null;
    this.timeoutWarningId = null;
  }

  // --- Outgoing events (mirrors backend/event/OutgoingEvents.ts) ---------

  // emitEvent restarts the idle timeout; emitEventWithoutResetingTimout does
  // not (backend/event/OutgoingEvents.ts:19-26). Browser sockets receive the
  // bare event name — the /<pillar>/ prefix is OSC-only.
  private emit(eventName: string, data?: Record<string, unknown>, resetTimeout = true) {
    if (resetTimeout) this.restartTimeoutTimer();
    this.logger.info(`emit ${eventName} ${data ? JSON.stringify(data) : ''}`);
    this.listeners.forEach((listener) => listener({ eventName, data }));
  }

  // --- Idle timeout (mirrors backend/adapter/AbletonAdapter.ts:54-88) -----------------

  private shouldShowTimeout() {
    return (
      this.playingClips.filter((clip) => clip).length > 0 &&
      this.stoppingClips.filter((clip) => clip).length === 0
    );
  }

  private restartTimeoutTimer() {
    // Always clear first, even when now-disabled — mirrors
    // AbletonAdapter.restartTimeoutTimer/startTimeoutTimer (WOW-007C): a
    // disabled timeout must not leave a stale timer armed from before it was
    // turned off.
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.timeoutWarningId) clearTimeout(this.timeoutWarningId);
    this.timeoutId = null;
    this.timeoutWarningId = null;
    if (!this.idleTimeoutEnabled) return;
    // Mirrors the backend's guard: never arm the warning with a
    // zero/negative delay (audio-ableton review, PR #56).
    const warningDelay = this.timeoutMs - this.timeoutWarningMs;
    if (warningDelay > 0) {
      this.timeoutWarningId = setTimeout(() => {
        if (this.shouldShowTimeout()) {
          this.logger.warn('Timeout warning');
          this.emit('timeout_warning', undefined, false);
        }
      }, warningDelay);
    }
    this.timeoutId = setTimeout(() => {
      if (this.shouldShowTimeout()) {
        this.logger.warn('Timeout exceeded, restarting the UI');
        this.handleTimeout();
      }
    }, this.timeoutMs);
  }

  // Mirrors handleTimeout (backend/adapter/AbletonAdapter.ts:147): every track is stopped
  // (the browser sees a bare clip_stopped per pillar, since stoppingClips is
  // empty on this path), the master key resets and emits master-key_changed,
  // and any still-queued clips are dropped with clip_unqueued per occupied
  // pillar — all via the without-reset emit variant so the timeout's own
  // cleanup doesn't re-arm the timer it just fired (WOW-018).
  private handleTimeout() {
    this.playingClips.forEach((clip, pillar) => {
      if (clip) {
        this.emit('clip_stopped', { pillar }, false);
        this.playingClips[pillar] = null;
      }
    });
    this.masterKey = '';
    this.emit('master-key_changed', { key: this.masterKey }, false);

    this.queuedClips.forEach((queued, pillar) => {
      if (!queued) return;
      this.queuedClips[pillar] = null;
      this.emit('clip_unqueued', { ...queued, clip: undefined }, false);
    });
  }

  // --- Tag events (mirrors backend/event/IncomingEvents.ts:33-97) -------

  handleNewTag(data: TagDetectionData) {
    if (!isValidPillar(data.pillar)) {
      this.logger.warn(`Ignoring /new/tag with invalid pillar index: ${data.pillar}`);
      return;
    }
    const requestAddress = getPillarIPAddressFromIndex(data.pillar);
    this.logger.info(`New tag detected with ${data.rfid} from machine: ${requestAddress}`);
    const clipMetadata = this.database.rfidToClipMap[data.rfid];
    if (!clipMetadata) {
      this.logger.warn("Couldn't find track from RFID tag");
      return;
    }
    this.emit('ingredient_detected', {
      ...clipMetadata,
      rfid: data.rfid,
      pillar: data.pillar,
      requestAddress,
    });
    this.queueClip(
      { ...clipMetadata, rfid: data.rfid, clipName: clipMetadata.clipName },
      data.pillar,
    );
  }

  handleDepartedTag(data: TagDetectionData) {
    if (!isValidPillar(data.pillar)) {
      this.logger.warn(`Ignoring /departed/tag with invalid pillar index: ${data.pillar}`);
      return;
    }
    const requestAddress = getPillarIPAddressFromIndex(data.pillar);
    this.logger.info(`Departed tag detected with ${data.rfid} from machine: ${requestAddress}`);
    const clipMetadata = this.database.rfidToClipMap[data.rfid];
    if (!clipMetadata) {
      this.logger.warn("Couldn't find track from RFID tag");
      return;
    }
    // Note: unlike ingredient_detected, the real payload carries no rfid
    // (backend/event/IncomingEvents.ts:89).
    this.emit('ingredient_removed', {
      ...clipMetadata,
      pillar: data.pillar,
      requestAddress,
    });
    this.stopOrRemoveClipFromQueue(clipMetadata.clipName, data.pillar);
  }

  // --- Clip lifecycle (mirrors queueClip / triggerQueuedClips /
  // stopOrRemoveClipFromQueue and the playing_slot_index listener in
  // backend/adapter/AbletonAdapter.ts) -------------------------------------------------

  private queueClip(clipMetadata: Omit<BrowserClipInfo, 'pillar'>, pillar: number) {
    const { clipName, key } = clipMetadata;
    const queued = this.queuedClips[pillar];
    if (queued && normalizeClipName(queued.clipName) === normalizeClipName(clipName)) {
      this.logger.info(`Clip ${clipName} is already queued`);
      return;
    }

    const silence = this.playingClips.every((clip) => !clip);
    if (silence || this.masterKey === '') {
      // Coming from silence or an undefined key state: adopt this clip's key
      // (backend/adapter/AbletonAdapter.ts:147-150)
      if (key) this.setMasterKey(key);
    }

    if (silence) {
      this.logger.info(`Triggering clip "${clipName}" on pillar ${pillar + 1}`);
      this.startClip({ ...clipMetadata, pillar });
    } else {
      this.logger.info(`Queuing clip "${clipName}" on pillar ${pillar + 1}`);
      this.queuedClips[pillar] = { ...clipMetadata, pillar };
      this.emit('clip_queued', { pillar, ...clipMetadata });
      this.schedulePhraseTrigger();
    }
  }

  // Stand-in for the phrase leader's loop-end listener
  // (backend/adapter/AbletonAdapter.ts:249-274): queued clips fire at the next phrase
  // boundary, approximated with a fixed-length timer.
  private schedulePhraseTrigger() {
    if (this.phraseTimerId) return;
    this.phraseTimerId = setTimeout(() => {
      this.phraseTimerId = null;
      this.triggerQueuedClips();
    }, this.phraseLengthMs);
  }

  private triggerQueuedClips() {
    this.queuedClips.forEach((queued, pillar) => {
      if (!queued) return;
      this.queuedClips[pillar] = null;
      this.startClip(queued);
    });
  }

  // Mirrors the browser-observable effects of the playing_slot_index listener
  // (backend/adapter/AbletonAdapter.ts:286-335).
  private startClip(clipInfo: BrowserClipInfo) {
    const { pillar, clipName } = clipInfo;
    const bpm = this.database.bpmByRfid[clipInfo.rfid] ?? this.tempo;
    const wasSilence = this.playingClips.every((clip) => !clip);

    if (this.playingClips[pillar]?.clipName === clipName) {
      this.emit('clip_playing', { ...clipInfo, bpm }, false);
    } else {
      this.emit('clip_started', { ...clipInfo, bpm });
      // WOW-007C (human request): restore the last volume explicitly asked
      // for on this pillar instead of always slamming the pre-existing
      // hardcoded 0.6 — mirrors resolveClipStartVolume
      // (backend/adapter/AbletonAdapter.ts).
      this.setTrackVolume({ pillar, volume: this.desiredVolumes[pillar] ?? 0.6 });
    }
    if (wasSilence) {
      // Coming from silence: adopt the clip's bpm and key
      // (backend/adapter/AbletonAdapter.ts:324-328)
      this.setTempo(bpm);
      if (clipInfo.key) this.setMasterKey(clipInfo.key);
    }
    this.playingClips[pillar] = clipInfo;
  }

  private stopOrRemoveClipFromQueue(clipName: string, pillar: number) {
    const playingClip = this.playingClips[pillar];
    const queuedClip = this.queuedClips[pillar];
    const normalized = normalizeClipName(clipName);

    const isClipPlaying = !!playingClip && normalizeClipName(playingClip.clipName) === normalized;
    if (isClipPlaying) {
      this.logger.info(`Stopping clip "${clipName}" on pillar ${pillar + 1}`);
      this.stoppingClips[pillar] = playingClip;
      this.emit('clip_stopping', { ...playingClip, clip: undefined });
      // Track stop → playing_slot_index -1 → clip_stopped with the stopping
      // clip's info (backend/adapter/AbletonAdapter.ts:338-344), synchronous in the sim.
      this.emit('clip_stopped', { ...playingClip, pillar, clip: undefined }, false);
      this.stoppingClips[pillar] = null;
      this.playingClips[pillar] = null;
      // Phrase-leader hand-off: with no clip left to promote, queued clips
      // fire immediately (backend/adapter/AbletonAdapter.ts:210-219).
      if (this.playingClips.every((clip) => !clip) && this.queuedClips.some((clip) => clip)) {
        this.triggerQueuedClips();
      }
    }

    const isClipQueued = !!queuedClip && normalizeClipName(queuedClip.clipName) === normalized;
    if (isClipQueued) {
      this.logger.info(`Removing clip from queue "${clipName}" on pillar ${pillar + 1}`);
      this.queuedClips[pillar] = null;
      this.emit('clip_unqueued', { ...queuedClip, clip: undefined });
    }

    if (!isClipPlaying && !isClipQueued) {
      this.logger.warn(
        `Clip ${clipName} is neither playing or queue. Stopping pillar ${pillar + 1} just in case.`,
      );
      this.emit('clip_stopped', { pillar }, false);
    }
  }

  // --- Ack-style request handlers (mirrors addSocketEventsHandlers,
  // backend/event/IncomingEvents.ts:99-177) ------------------------------

  // The acks project a fixed subset of fields — ingredientName/key/etc. are
  // not included (backend/event/IncomingEvents.ts:106-143).
  private toBrowserClipInfoList(slots: ClipSlot[]): BrowserClipInfoList {
    return slots.map((data) => {
      if (data) {
        const { pillar, clipName, type, assetName, rfid, artist, songTitle } = data;
        return { pillar, clipName, type, assetName, rfid, artist, songTitle };
      }
      return data;
    });
  }

  getPlayingClips(): BrowserClipInfoList {
    return this.toBrowserClipInfoList(this.playingClips);
  }

  getQueuedClips(): BrowserClipInfoList {
    return this.toBrowserClipInfoList(this.queuedClips);
  }

  getTempo(): number {
    return this.tempo;
  }

  setTempo(tempo: number): number {
    this.logger.info(`Setting tempo to: ${tempo}`);
    this.tempo = tempo;
    this.emit('tempo_changed', { tempo });
    return this.tempo;
  }

  getTrackVolumes(): TrackVolumesType {
    return [...this.trackVolumes];
  }

  // Fire-and-forget in the real contract — no ack callback
  // (backend/event/IncomingEvents.ts:160).
  setTrackVolume({ pillar, volume }: SetTrackVolumeInputType) {
    if (!isValidPillar(pillar)) {
      this.logger.warn(`Ignoring set_track_volume with invalid pillar index: ${pillar}`);
      return;
    }
    // Clamped exactly like the backend's setTrackVolume (general review,
    // PR #56 — the echoes must match what the real backend would emit).
    const clampedVolume = clampVolume(volume);
    this.logger.info(`Setting volume for pillar ${pillar + 1} to ${clampedVolume}`);
    this.trackVolumes[pillar] = clampedVolume;
    // WOW-007C (human request): remember what was explicitly asked for on
    // this pillar so the next clip that starts here restores it — mirrors
    // AbletonAdapter.setTrackVolume's desiredVolumes bookkeeping.
    this.desiredVolumes[pillar] = clampedVolume;
    this.emit('volume_changed', { pillar, volume: clampedVolume });
  }

  getKeyLockState(): boolean {
    return this.keyLockEnabled;
  }

  // Toggling key lock only re-transposes clips inside Ableton — the real
  // backend emits no browser event here (backend/adapter/AbletonAdapter.ts:416).
  setKeyLockState(state: boolean): boolean {
    this.keyLockEnabled = state;
    this.logger.info(`Key lock: ${state}`);
    return this.keyLockEnabled;
  }

  getMasterKey(): string {
    return this.masterKey;
  }

  // Fire-and-forget in the real contract — no ack callback
  // (backend/event/IncomingEvents.ts:173).
  setMasterKey(newKey: string) {
    this.masterKey = newKey;
    this.emit('master-key_changed', { key: newKey });
  }

  // --- WOW-007C: cauldron drum-rack sample, cauldron volume, idle-timeout
  // config (mirrors the AbletonAdapter.ts additions of the same name) -------

  // Fire-and-forget in the real contract — no ack callback
  // (backend/event/IncomingEvents.ts's `trigger_cauldron_sample` handler).
  // The sim has no Live set to pick a random drum-rack clip from, so it
  // always reports the same deterministic clip name — shapes/acks/ordering
  // are what the frontend actually depends on, not which sample "played".
  triggerCauldronSample() {
    this.logger.info(`Triggering cauldron sample: ${SIM_CAULDRON_CLIP_NAME}`);
    this.emit('cauldron_sample_triggered', { clipName: SIM_CAULDRON_CLIP_NAME });
  }

  getCauldronVolume(): number {
    return this.cauldronVolume;
  }

  setCauldronVolume({ volume }: SetCauldronVolumeInputType): number {
    const clampedVolume = clampCauldronVolume(volume);
    this.logger.info(`Setting cauldron volume to ${clampedVolume}`);
    this.cauldronVolume = clampedVolume;
    this.emit('cauldron_volume_changed', { volume: clampedVolume });
    return this.cauldronVolume;
  }

  getIdleTimeoutConfig(): IdleTimeoutConfigType {
    return { enabled: this.idleTimeoutEnabled, timeoutMs: this.timeoutMs };
  }

  // Validates and applies a new idle-timeout config, then re-arms (or
  // clears) the running timers immediately — mirrors
  // AbletonAdapter.setIdleTimeoutConfig, including the "ignore invalid,
  // don't guess" posture. Uses the without-reset emit variant deliberately:
  // changing this setting is not itself visitor activity.
  setIdleTimeoutConfig(config: IdleTimeoutConfigType): IdleTimeoutConfigType {
    const { enabled, timeoutMs } = config;
    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < MIN_IDLE_TIMEOUT_MS ||
      timeoutMs > MAX_IDLE_TIMEOUT_MS
    ) {
      this.logger.warn(
        `Ignoring setIdleTimeoutConfig: timeoutMs ${timeoutMs} must be an integer in [${MIN_IDLE_TIMEOUT_MS}, ${MAX_IDLE_TIMEOUT_MS}]`,
      );
      return this.getIdleTimeoutConfig();
    }
    this.idleTimeoutEnabled = Boolean(enabled);
    this.timeoutMs = timeoutMs;
    this.logger.info(
      `Idle timeout config: enabled=${this.idleTimeoutEnabled} timeoutMs=${this.timeoutMs}`,
    );
    this.restartTimeoutTimer();
    this.emit('idle_timeout_changed', this.getIdleTimeoutConfig(), false);
    return this.getIdleTimeoutConfig();
  }
}
