/**
 * Fake backend state machine mirroring the browser-observable behavior of the
 * real backend (backend/events/incoming-events.ts + backend/ableton-api.ts).
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
 *   markers (backend/ableton-api.ts:434).
 * - The real backend's missing-clip branch (backend/ableton-api.ts:185-191:
 *   `clip_unqueued` when a CSV clip has no matching clip in the live Ableton
 *   set) is not modeled — the sim has no live set, so every database clip
 *   "exists". Shapes and acks are unaffected.
 */
import { MusicDatabase, getPillarIPAddressFromIndex } from './music-database';
import {
  BrowserClipInfo,
  BrowserClipInfoList,
  SetTrackVolumeInputType,
  SimEventListener,
  TagDetectionData,
  TrackVolumesType,
} from './types';

// Mirror TIMEOUT_IN_MILISECONDS / TIMEOUT_WARNING_IN_MILISECONDS
// (backend/ableton-api.ts:19-20)
export const TIMEOUT_IN_MILISECONDS = 60 * 3 * 1000;
export const TIMEOUT_WARNING_IN_MILISECONDS = 30 * 1000;

const PILLAR_COUNT = 4;

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

const normalizeClipName = (clipName: string) => clipName.replace(/[* ]/g, '');

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
  private readonly timeoutMs: number;
  private readonly timeoutWarningMs: number;

  private tempo: number;
  private trackVolumes: TrackVolumesType;
  private keyLockEnabled = true; // mirrors backend/ableton-api.ts:31
  private masterKey = ''; // mirrors backend/ableton-api.ts:32
  private playingClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);
  private queuedClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);
  private stoppingClips: ClipSlot[] = new Array(PILLAR_COUNT).fill(null);

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

  // --- Outgoing events (mirrors backend/events/outgoing-events.ts) ---------

  // EmitEvent restarts the idle timeout; EmitEventWithoutResetingTimout does
  // not (backend/events/outgoing-events.ts:34-41). Browser sockets receive the
  // bare event name — the /<pillar>/ prefix is OSC-only.
  private emit(eventName: string, data?: Record<string, unknown>, resetTimeout = true) {
    if (resetTimeout) this.restartTimeoutTimer();
    this.logger.info(`emit ${eventName} ${data ? JSON.stringify(data) : ''}`);
    this.listeners.forEach((listener) => listener({ eventName, data }));
  }

  // --- Idle timeout (mirrors backend/ableton-api.ts:49-83) -----------------

  private shouldShowTimeout() {
    return (
      this.playingClips.filter((clip) => clip).length > 0 &&
      this.stoppingClips.filter((clip) => clip).length === 0
    );
  }

  private restartTimeoutTimer() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.timeoutWarningId) clearTimeout(this.timeoutWarningId);
    this.timeoutWarningId = setTimeout(() => {
      if (this.shouldShowTimeout()) {
        this.logger.warn('Timeout warning');
        this.emit('timeout_warning', undefined, false);
      }
    }, this.timeoutMs - this.timeoutWarningMs);
    this.timeoutId = setTimeout(() => {
      if (this.shouldShowTimeout()) {
        this.logger.warn('Timeout exceeded, restarting the UI');
        this.handleTimeout();
      }
    }, this.timeoutMs);
  }

  // Mirrors handleTimeout (backend/adapter/AbletonAdapter.ts): every track is stopped
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

  // --- Tag events (mirrors backend/events/incoming-events.ts:42-101) -------

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
    // (backend/events/incoming-events.ts:93).
    this.emit('ingredient_removed', {
      ...clipMetadata,
      pillar: data.pillar,
      requestAddress,
    });
    this.stopOrRemoveClipFromQueue(clipMetadata.clipName, data.pillar);
  }

  // --- Clip lifecycle (mirrors QueueClip / TriggerQueuedClips /
  // StopOrRemoveClipFromQueue and the playing_slot_index listener in
  // backend/ableton-api.ts) -------------------------------------------------

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
      // (backend/ableton-api.ts:160-163)
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
  // (backend/ableton-api.ts:262-287): queued clips fire at the next phrase
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
  // (backend/ableton-api.ts:299-347).
  private startClip(clipInfo: BrowserClipInfo) {
    const { pillar, clipName } = clipInfo;
    const bpm = this.database.bpmByRfid[clipInfo.rfid] ?? this.tempo;
    const wasSilence = this.playingClips.every((clip) => !clip);

    if (this.playingClips[pillar]?.clipName === clipName) {
      this.emit('clip_playing', { ...clipInfo, bpm }, false);
    } else {
      this.emit('clip_started', { ...clipInfo, bpm });
      this.setTrackVolume({ pillar, volume: 0.6 });
    }
    if (wasSilence) {
      // Coming from silence: adopt the clip's bpm and key
      // (backend/ableton-api.ts:336-340)
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
      // clip's info (backend/ableton-api.ts:350-356), synchronous in the sim.
      this.emit('clip_stopped', { ...playingClip, pillar, clip: undefined }, false);
      this.stoppingClips[pillar] = null;
      this.playingClips[pillar] = null;
      // Phrase-leader hand-off: with no clip left to promote, queued clips
      // fire immediately (backend/ableton-api.ts:223-232).
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

  // --- Ack-style request handlers (mirrors AddSocketEventsHandlers,
  // backend/events/incoming-events.ts:103-181) ------------------------------

  // The acks project a fixed subset of fields — ingredientName/key/etc. are
  // not included (backend/events/incoming-events.ts:110-147).
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
  // (backend/events/incoming-events.ts:164).
  setTrackVolume({ pillar, volume }: SetTrackVolumeInputType) {
    if (!isValidPillar(pillar)) {
      this.logger.warn(`Ignoring set_track_volume with invalid pillar index: ${pillar}`);
      return;
    }
    this.logger.info(`Setting volume for pillar ${pillar + 1} to ${volume}`);
    this.trackVolumes[pillar] = volume;
    this.emit('volume_changed', { pillar, volume });
  }

  getKeyLockState(): boolean {
    return this.keyLockEnabled;
  }

  // Toggling key lock only re-transposes clips inside Ableton — the real
  // backend emits no browser event here (backend/ableton-api.ts:445).
  setKeyLockState(state: boolean): boolean {
    this.keyLockEnabled = state;
    this.logger.info(`Key lock: ${state}`);
    return this.keyLockEnabled;
  }

  getMasterKey(): string {
    return this.masterKey;
  }

  // Fire-and-forget in the real contract — no ack callback
  // (backend/events/incoming-events.ts:177).
  setMasterKey(newKey: string) {
    this.masterKey = newKey;
    this.emit('master-key_changed', { key: newKey });
  }
}
