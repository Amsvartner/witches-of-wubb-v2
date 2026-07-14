import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClipTypes,
  MusicDatabase,
  SimEmittedEvent,
  Simulator,
  TIMEOUT_IN_MILISECONDS,
  TIMEOUT_WARNING_IN_MILISECONDS,
  buildMusicDatabase,
  pickScenarioIngredients,
} from '../core';

const csvText = fs.readFileSync(
  path.join(process.cwd(), 'src', 'assets', 'Music Database.csv'),
  'utf-8',
);
const database: MusicDatabase = buildMusicDatabase(csvText);
const picks = pickScenarioIngredients(database);
const drums = picks[ClipTypes.Drums];
const melody = picks[ClipTypes.Melody];

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const PHRASE_LENGTH_MS = 1000;

describe('Simulator', () => {
  let simulator: Simulator;
  let events: SimEmittedEvent[];
  const eventNames = () => events.map((event) => event.eventName);
  const lastEvent = (name: string) => [...events].reverse().find((e) => e.eventName === name);

  beforeEach(() => {
    vi.useFakeTimers();
    simulator = new Simulator({
      database,
      phraseLengthMs: PHRASE_LENGTH_MS,
      logger: silentLogger,
    });
    events = [];
    simulator.onEvent((event) => events.push(event));
  });

  afterEach(() => {
    simulator.dispose();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('has four empty pillars for playing and queued clips', () => {
      expect(simulator.getPlayingClips()).toEqual([null, null, null, null]);
      expect(simulator.getQueuedClips()).toEqual([null, null, null, null]);
    });

    it('has sim-default tempo, volumes, key lock, and master key', () => {
      expect(simulator.getTempo()).toBe(120);
      expect(simulator.getTrackVolumes()).toEqual([0.6, 0.6, 0.6, 0.6]);
      expect(simulator.getKeyLockState()).toBe(true);
      expect(simulator.getMasterKey()).toBe('');
    });
  });

  describe('settings round-trips', () => {
    it('set_tempo updates state and emits tempo_changed', () => {
      expect(simulator.setTempo(95)).toBe(95);
      expect(simulator.getTempo()).toBe(95);
      expect(lastEvent('tempo_changed')?.data).toEqual({ tempo: 95 });
    });

    it('set_track_volume updates one pillar and emits volume_changed', () => {
      simulator.setTrackVolume({ pillar: 2, volume: 0.3 });
      expect(simulator.getTrackVolumes()).toEqual([0.6, 0.6, 0.3, 0.6]);
      expect(lastEvent('volume_changed')?.data).toEqual({ pillar: 2, volume: 0.3 });
    });

    it('set_keylock_state round-trips without emitting any event (as in the real backend)', () => {
      expect(simulator.setKeyLockState(false)).toBe(false);
      expect(simulator.getKeyLockState()).toBe(false);
      expect(events).toEqual([]);
    });

    it('set_master-key updates state and emits master-key_changed', () => {
      simulator.setMasterKey('5A');
      expect(simulator.getMasterKey()).toBe('5A');
      expect(lastEvent('master-key_changed')?.data).toEqual({ key: '5A' });
    });
  });

  describe('/new/tag', () => {
    it('emits the backend event sequence when starting from silence', () => {
      const metadata = database.rfidToClipMap[drums.rfid];
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });

      // Same observable order as the real backend: ingredient_detected, key
      // adoption from queueClip, then the clip-start burst (clip_started,
      // volume_changed, tempo_changed, master-key_changed again).
      const expected = ['ingredient_detected'];
      if (metadata.key) expected.push('master-key_changed');
      expected.push('clip_started', 'volume_changed', 'tempo_changed');
      if (metadata.key) expected.push('master-key_changed');
      expect(eventNames()).toEqual(expected);

      expect(lastEvent('ingredient_detected')?.data).toEqual({
        ...metadata,
        rfid: drums.rfid,
        pillar: drums.pillar,
        requestAddress: `192.168.0.10${drums.pillar + 1}`,
      });
      const started = lastEvent('clip_started')?.data;
      expect(started).toMatchObject({
        clipName: metadata.clipName,
        pillar: drums.pillar,
        rfid: drums.rfid,
        bpm: database.bpmByRfid[drums.rfid],
      });
      expect(lastEvent('volume_changed')?.data).toEqual({ pillar: drums.pillar, volume: 0.6 });
      expect(simulator.getTempo()).toBe(database.bpmByRfid[drums.rfid]);
    });

    it('exposes the playing clip through get_playing_clips with the ack field subset', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      const playing = simulator.getPlayingClips();
      expect(playing).toHaveLength(4);
      const metadata = database.rfidToClipMap[drums.rfid];
      expect(playing[drums.pillar]).toEqual({
        pillar: drums.pillar,
        clipName: metadata.clipName,
        type: metadata.type,
        assetName: metadata.assetName,
        rfid: drums.rfid,
        artist: metadata.artist,
        songTitle: metadata.songTitle,
      });
      playing.forEach((slot, pillar) => {
        if (pillar !== drums.pillar) expect(slot).toBeNull();
      });
    });

    it('ignores out-of-range pillar indices without stretching the 4-slot state', () => {
      [-1, 4, 7, 1.5, NaN].forEach((pillar) => {
        simulator.handleNewTag({ rfid: drums.rfid, pillar });
        simulator.handleDepartedTag({ rfid: drums.rfid, pillar });
        simulator.setTrackVolume({ pillar, volume: 0.5 });
      });
      expect(events).toEqual([]);
      expect(simulator.getPlayingClips()).toHaveLength(4);
      expect(simulator.getQueuedClips()).toHaveLength(4);
      expect(simulator.getTrackVolumes()).toEqual([0.6, 0.6, 0.6, 0.6]);
    });

    it('ignores unknown RFIDs without crashing or emitting', () => {
      simulator.handleNewTag({ rfid: 'not-a-real-tag', pillar: 0 });
      expect(events).toEqual([]);
      expect(simulator.getPlayingClips()).toEqual([null, null, null, null]);
    });

    it('queues a second clip while music plays, then triggers it at the phrase boundary', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      expect(eventNames()).toContain('clip_queued');
      expect(eventNames()).not.toContain('clip_started');
      expect(simulator.getQueuedClips()[melody.pillar]).toMatchObject({ rfid: melody.rfid });

      vi.advanceTimersByTime(PHRASE_LENGTH_MS);
      expect(eventNames()).toContain('clip_started');
      expect(simulator.getQueuedClips()[melody.pillar]).toBeNull();
      expect(simulator.getPlayingClips()[melody.pillar]).toMatchObject({ rfid: melody.rfid });
    });

    it('replaces the object on an occupied pillar (one object per pillar)', () => {
      const secondDrums = Object.entries(database.rfidToClipMap).find(
        ([rfid, metadata]) =>
          metadata.type === ClipTypes.Drums &&
          rfid !== drums.rfid &&
          database.bpmByRfid[rfid] !== undefined,
      );
      expect(secondDrums, 'CSV needs a second drums row for this test').toBeTruthy();
      const [replacementRfid] = secondDrums!;

      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      simulator.handleNewTag({ rfid: replacementRfid, pillar: drums.pillar });
      // Old object still plays while the replacement waits in the queue
      expect(simulator.getPlayingClips()[drums.pillar]).toMatchObject({ rfid: drums.rfid });
      expect(simulator.getQueuedClips()[drums.pillar]).toMatchObject({ rfid: replacementRfid });

      vi.advanceTimersByTime(PHRASE_LENGTH_MS);
      expect(simulator.getPlayingClips()[drums.pillar]).toMatchObject({ rfid: replacementRfid });
      expect(simulator.getQueuedClips()[drums.pillar]).toBeNull();
    });
  });

  describe('/departed/tag', () => {
    it('stops a playing clip: ingredient_removed (no rfid), clip_stopping, clip_stopped', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      simulator.handleDepartedTag({ rfid: drums.rfid, pillar: drums.pillar });
      expect(eventNames()).toEqual(['ingredient_removed', 'clip_stopping', 'clip_stopped']);
      const metadata = database.rfidToClipMap[drums.rfid];
      expect(lastEvent('ingredient_removed')?.data).toEqual({
        ...metadata,
        pillar: drums.pillar,
        requestAddress: `192.168.0.10${drums.pillar + 1}`,
      });
      expect(lastEvent('ingredient_removed')?.data).not.toHaveProperty('rfid');
      expect(simulator.getPlayingClips()[drums.pillar]).toBeNull();
    });

    it('removes a queued clip with clip_unqueued', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      events = [];

      simulator.handleDepartedTag({ rfid: melody.rfid, pillar: melody.pillar });
      expect(eventNames()).toEqual(['ingredient_removed', 'clip_unqueued']);
      expect(simulator.getQueuedClips()[melody.pillar]).toBeNull();
    });

    it('emits a bare clip_stopped for a pillar with nothing playing or queued', () => {
      simulator.handleDepartedTag({ rfid: drums.rfid, pillar: drums.pillar });
      expect(eventNames()).toEqual(['ingredient_removed', 'clip_stopped']);
      expect(lastEvent('clip_stopped')?.data).toEqual({ pillar: drums.pillar });
    });

    it('triggers queued clips immediately when the last playing clip stops', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      events = [];

      simulator.handleDepartedTag({ rfid: drums.rfid, pillar: drums.pillar });
      expect(eventNames()).toContain('clip_started');
      expect(simulator.getPlayingClips()[melody.pillar]).toMatchObject({ rfid: melody.rfid });
    });
  });

  describe('clip lifecycle details', () => {
    it('exposes the queued clip through get_queued_clips with the ack field subset', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });

      const queued = simulator.getQueuedClips();
      expect(queued).toHaveLength(4);
      const metadata = database.rfidToClipMap[melody.rfid];
      // Exact 7-field projection (backend/event/IncomingEvents.ts:125-143):
      // ingredientName/key are dropped, and no live `clip` object leaks.
      expect(queued[melody.pillar]).toEqual({
        pillar: melody.pillar,
        clipName: metadata.clipName,
        type: metadata.type,
        assetName: metadata.assetName,
        rfid: melody.rfid,
        artist: metadata.artist,
        songTitle: metadata.songTitle,
      });
      queued.forEach((slot, pillar) => {
        if (pillar !== melody.pillar) expect(slot).toBeNull();
      });
    });

    it('does not emit a second clip_queued when the same clip is already queued', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      // Mirrors the "already queued" early return (backend/adapter/AbletonAdapter.ts:137)
      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      expect(eventNames().filter((name) => name === 'clip_queued')).toHaveLength(1);
      // ingredient_detected still fires for each physical detection
      expect(eventNames().filter((name) => name === 'ingredient_detected')).toHaveLength(2);
    });

    it('re-triggering the clip already playing on a pillar emits clip_playing, not clip_started', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      // Same tag placed again on its own pillar: it queues (the queue slot is
      // empty) and at the phrase boundary restarts the same clip — the real
      // backend's playing_slot_index handler then takes the clip_playing
      // branch (backend/adapter/AbletonAdapter.ts:318-319) with no volume reset.
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      expect(eventNames()).toEqual(['ingredient_detected', 'clip_queued']);

      vi.advanceTimersByTime(PHRASE_LENGTH_MS);
      expect(eventNames()).toEqual(['ingredient_detected', 'clip_queued', 'clip_playing']);
      const playing = lastEvent('clip_playing')?.data;
      expect(playing).toMatchObject({
        clipName: database.rfidToClipMap[drums.rfid].clipName,
        pillar: drums.pillar,
        bpm: database.bpmByRfid[drums.rfid],
      });
      expect(simulator.getPlayingClips()[drums.pillar]).toMatchObject({ rfid: drums.rfid });
    });

    it('clip_stopping and clip_stopped carry the stopping clip metadata and no live clip object', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      simulator.handleDepartedTag({ rfid: drums.rfid, pillar: drums.pillar });
      const metadata = database.rfidToClipMap[drums.rfid];
      const stopping = lastEvent('clip_stopping')?.data;
      expect(stopping).toMatchObject({
        clipName: metadata.clipName,
        pillar: drums.pillar,
        rfid: drums.rfid,
      });
      // `clip: undefined` in the real payload spread (backend/adapter/AbletonAdapter.ts:203-206)
      // — must never be a live object (socket.io drops undefined on the wire)
      expect(stopping?.clip).toBeUndefined();
      const stopped = lastEvent('clip_stopped')?.data;
      expect(stopped).toMatchObject({
        clipName: metadata.clipName,
        pillar: drums.pillar,
      });
      expect(stopped?.clip).toBeUndefined();
    });

    it('does not re-adopt tempo or key when a clip triggers into already-playing music', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      const adoptedTempo = simulator.getTempo();
      const adoptedKey = simulator.getMasterKey();
      events = [];

      simulator.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar });
      vi.advanceTimersByTime(PHRASE_LENGTH_MS);
      // Adoption only happens when coming from silence (backend/adapter/AbletonAdapter.ts:324-328)
      expect(eventNames()).not.toContain('tempo_changed');
      expect(simulator.getTempo()).toBe(adoptedTempo);
      expect(simulator.getMasterKey()).toBe(adoptedKey);
    });
  });

  describe('idle timeout', () => {
    it('emits timeout_warning 30s before the 3-minute timeout, then stops all clips and announces the cleared master key', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS);
      expect(eventNames()).toEqual(['timeout_warning']);
      expect(lastEvent('timeout_warning')?.data).toBeUndefined();

      vi.advanceTimersByTime(TIMEOUT_WARNING_IN_MILISECONDS);
      expect(eventNames()).toEqual(['timeout_warning', 'clip_stopped', 'master-key_changed']);
      expect(lastEvent('clip_stopped')?.data).toEqual({ pillar: drums.pillar });
      expect(simulator.getPlayingClips()).toEqual([null, null, null, null]);
      // WOW-018: handleTimeout now announces the cleared key instead of
      // silently resetting it, so the UI doesn't keep showing a stale key.
      expect(simulator.getMasterKey()).toBe('');
      expect(lastEvent('master-key_changed')?.data).toEqual({ key: '' });
    });

    it('drops any still-queued clip at timeout, emitting clip_unqueued per occupied pillar (WOW-018)', () => {
      // A short timeoutMs (comfortably under the default 1000ms phraseLengthMs)
      // fires the idle timeout before the phrase-boundary timer would otherwise
      // auto-trigger the queued clip, so the "still queued at timeout" state is
      // actually observable.
      const shortTimeoutSim = new Simulator({
        database,
        phraseLengthMs: PHRASE_LENGTH_MS,
        timeoutMs: 500,
        timeoutWarningMs: 100,
        logger: silentLogger,
      });
      const shortEvents: SimEmittedEvent[] = [];
      shortTimeoutSim.onEvent((event) => shortEvents.push(event));

      shortTimeoutSim.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar }); // starts playing
      shortTimeoutSim.handleNewTag({ rfid: melody.rfid, pillar: melody.pillar }); // queued behind it
      expect(shortTimeoutSim.getQueuedClips()[melody.pillar]).not.toBeNull();
      shortEvents.length = 0;

      vi.advanceTimersByTime(500);

      const unqueued = shortEvents.find((e) => e.eventName === 'clip_unqueued');
      expect(unqueued?.data).toMatchObject({ pillar: melody.pillar, clip: undefined });
      expect(shortTimeoutSim.getQueuedClips()).toEqual([null, null, null, null]);

      shortTimeoutSim.dispose();
    });

    it('does not fire the timeout while nothing is playing', () => {
      simulator.setTempo(100); // starts the timer via an emitted event
      events = [];
      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS * 2);
      expect(events).toEqual([]);
    });

    it('falls back to the real defaults when configured with warning >= timeout', () => {
      const misconfigured = new Simulator({
        database,
        timeoutMs: 1000,
        timeoutWarningMs: 5000,
        logger: silentLogger,
      });
      const misconfiguredEvents: SimEmittedEvent[] = [];
      misconfigured.onEvent((event) => misconfiguredEvents.push(event));
      misconfigured.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      misconfiguredEvents.length = 0;

      // No immediate/near-immediate warning from a negative delay
      vi.advanceTimersByTime(60 * 1000);
      expect(misconfiguredEvents).toEqual([]);
      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS - 60 * 1000);
      expect(misconfiguredEvents.map((e) => e.eventName)).toEqual(['timeout_warning']);
      misconfigured.dispose();
    });

    it('is pushed back by new activity', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS - 1000);
      simulator.setTempo(100); // activity resets the idle timer
      events = [];
      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS - 1000);
      expect(eventNames()).not.toContain('timeout_warning');
    });
  });
});

// Key-adoption semantics from queueClip (backend/adapter/AbletonAdapter.ts:147-150) need
// clips with known, distinct keys — and one without a key — so this block uses
// a synthetic database with the real CSV column headers instead of relying on
// whatever rows the production CSV happens to contain.
describe('Simulator key adoption (synthetic database)', () => {
  const syntheticCsv = [
    'RFID,Clip Name,Clip Type (e.g. Vocals),Icon / Asset Name,Artist,Song Title,Ingredient Name / Description,Key,BPM',
    'rfid-drums,Synth Drums 100,Drums,drums.png,Artist A,Song A,Toad Legs,4A,100',
    'rfid-melody,Synth Melody 90,Melody,melody.png,Artist B,Song B,Newt Eyes,7B,90',
    'rfid-keyless,Synth Bass 80,Bass,bass.png,Artist C,Song C,Bat Wings,,80',
  ].join('\n');
  const syntheticDatabase = buildMusicDatabase(syntheticCsv);

  let simulator: Simulator;
  let events: SimEmittedEvent[];
  const eventNames = () => events.map((event) => event.eventName);

  beforeEach(() => {
    vi.useFakeTimers();
    simulator = new Simulator({
      database: syntheticDatabase,
      phraseLengthMs: PHRASE_LENGTH_MS,
      logger: silentLogger,
    });
    events = [];
    simulator.onEvent((event) => events.push(event));
  });

  afterEach(() => {
    simulator.dispose();
    vi.useRealTimers();
  });

  it('keeps the first clip’s master key when a different-key clip joins', () => {
    simulator.handleNewTag({ rfid: 'rfid-drums', pillar: 0 });
    expect(simulator.getMasterKey()).toBe('4A');
    expect(simulator.getTempo()).toBe(100);
    events = [];

    simulator.handleNewTag({ rfid: 'rfid-melody', pillar: 1 });
    vi.advanceTimersByTime(PHRASE_LENGTH_MS);
    // Music playing + master key set → no re-adoption of the 7B key
    expect(eventNames()).not.toContain('master-key_changed');
    expect(simulator.getMasterKey()).toBe('4A');
    expect(simulator.getTempo()).toBe(100);
  });

  it('starting from silence with a keyless clip leaves the master key empty', () => {
    simulator.handleNewTag({ rfid: 'rfid-keyless', pillar: 2 });
    expect(eventNames()).not.toContain('master-key_changed');
    expect(simulator.getMasterKey()).toBe('');
    // Tempo is still adopted from the clip's bpm
    expect(simulator.getTempo()).toBe(80);
  });

  it('adopts a queued clip’s key immediately when the master key is empty mid-playback', () => {
    simulator.handleNewTag({ rfid: 'rfid-keyless', pillar: 2 });
    events = [];

    // Music is playing but masterKey === '': queueClip adopts the new clip's
    // key at queue time, before the phrase boundary (backend/adapter/AbletonAdapter.ts:147-150)
    simulator.handleNewTag({ rfid: 'rfid-melody', pillar: 1 });
    expect(eventNames()).toEqual(['ingredient_detected', 'master-key_changed', 'clip_queued']);
    expect(simulator.getMasterKey()).toBe('7B');
  });
});
