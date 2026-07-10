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
} from '../../sim/core';

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
      // adoption from QueueClip, then the clip-start burst (clip_started,
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

  describe('idle timeout', () => {
    it('emits timeout_warning 30s before the 3-minute timeout, then stops all clips', () => {
      simulator.handleNewTag({ rfid: drums.rfid, pillar: drums.pillar });
      events = [];

      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS);
      expect(eventNames()).toEqual(['timeout_warning']);
      expect(lastEvent('timeout_warning')?.data).toBeUndefined();

      vi.advanceTimersByTime(TIMEOUT_WARNING_IN_MILISECONDS);
      expect(eventNames()).toEqual(['timeout_warning', 'clip_stopped']);
      expect(lastEvent('clip_stopped')?.data).toEqual({ pillar: drums.pillar });
      expect(simulator.getPlayingClips()).toEqual([null, null, null, null]);
      // The real handleTimeout clears the master key without emitting
      expect(simulator.getMasterKey()).toBe('');
      expect(eventNames()).not.toContain('master-key_changed');
    });

    it('does not fire the timeout while nothing is playing', () => {
      simulator.setTempo(100); // starts the timer via an emitted event
      events = [];
      vi.advanceTimersByTime(TIMEOUT_IN_MILISECONDS * 2);
      expect(events).toEqual([]);
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
