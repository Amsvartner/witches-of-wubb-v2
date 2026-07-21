import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';
import type { Clip } from 'ableton-js/ns/clip';
import type { ClipSlot } from 'ableton-js/ns/clip-slot';
import type { Track } from 'ableton-js/ns/track';
import { AbletonAdapter } from '../AbletonAdapter';
import { Logger } from '../../util/Logger';

// This test imports AbletonAdapter (and transitively ableton-js) despite the
// no-ableton-js-in-tests convention elsewhere in backend/**/test/**: the function under
// test (WOW-032's parseRemoteScriptVersion) is required by its ticket to live inside
// AbletonAdapter.ts specifically. Safe to import: the `Ableton` constructor (ableton-js
// index.js) only sets instance fields and computes tmpdir-based file paths - it opens no
// socket and does no I/O until .start() is called, which this test never does.
describe('AbletonAdapter.parseRemoteScriptVersion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-032-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFixture(content: string): string {
    const filePath = path.join(tmpDir, 'version.py');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it("parses a double-quoted version string, matching midi-script/version.py's own format", () => {
    const filePath = writeFixture('version = "3.1.5"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.1.5');
  });

  it('parses single-quoted version strings', () => {
    const filePath = writeFixture("version = '3.7.0'\n");
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('3.7.0');
  });

  it('parses pre-release/build-suffixed versions (e.g. ableton-js historical "2.2.1-0")', () => {
    const filePath = writeFixture('version = "2.2.1-0"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('2.2.1-0');
  });

  it('tolerates extra whitespace around the equals sign', () => {
    const filePath = writeFixture('version   =   "1.2.3"\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBe('1.2.3');
  });

  it('returns undefined for a missing file instead of throwing', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.py');
    expect(AbletonAdapter.parseRemoteScriptVersion(missingPath)).toBeUndefined();
  });

  it('returns undefined for a file with no version line', () => {
    const filePath = writeFixture('# just a comment\nprint("hello")\n');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBeUndefined();
  });

  it('returns undefined for an empty file', () => {
    const filePath = writeFixture('');
    expect(AbletonAdapter.parseRemoteScriptVersion(filePath)).toBeUndefined();
  });

  it('parses the real, currently-installed ableton-js midi-script version.py', () => {
    // Regression guard against the actual file this ticket depends on, not just
    // synthetic fixtures - catches an ableton-js upgrade changing the file's format.
    const packageJsonPath = require.resolve('ableton-js/package.json');
    const realPath = path.join(path.dirname(packageJsonPath), 'midi-script', 'version.py');
    expect(AbletonAdapter.parseRemoteScriptVersion(realPath)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
// WOW-020: a clip with degenerate warp markers must not push Infinity/NaN
// into setTempo - calculateBpmFromWarpMarkers returns undefined instead so
// callers can skip tempo adoption.
//
// The existing (unchanged) formula is `(endBT - startBT) / ((endST - startST) / 60)`
// - dividing the sample_time span by 60 only produces a sane BPM if that
// span is in seconds, not raw audio samples, despite the field's name.
// Verified against a known-good case before writing fixtures: 4 beats over
// 2 seconds is 120 BPM, and `(4 - 0) / ((2 - 0) / 60) === 120`.
describe('AbletonAdapter.calculateBpmFromWarpMarkers', () => {
  it('returns undefined for zero warp markers (would otherwise throw destructuring markers[0])', () => {
    expect(AbletonAdapter.calculateBpmFromWarpMarkers([])).toBeUndefined();
  });

  it('returns undefined for a single warp marker (fewer than 2 markers - the span is never even computed)', () => {
    const markers = [{ beat_time: 0, sample_time: 1 }];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for two markers at the same sample_time (division by zero)', () => {
    const markers = [
      { beat_time: 0, sample_time: 1 },
      { beat_time: 4, sample_time: 1 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for a negative sample-time span (out-of-order markers)', () => {
    const markers = [
      { beat_time: 0, sample_time: 2 },
      { beat_time: 4, sample_time: 1 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('returns undefined for a non-finite result that slips past the earlier guards (e.g. a NaN sample_time)', () => {
    // NaN <= 0 is false in JS, so the sampleTimeSpan guard alone would not
    // catch this - only the final Number.isFinite catch-all does. Regression
    // guard for that third guard specifically (test-engineer review, PR #25):
    // without it, this fixture would fall through to bpm = NaN instead of
    // undefined, and the call site's `bpm === undefined` check would then
    // fail to fire the clip-attributed warning too.
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 4, sample_time: NaN },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeUndefined();
  });

  it('calculates BPM for a healthy two-marker array, byte-for-byte the same arithmetic as before this ticket', () => {
    // 4 beats over 2 seconds = 120 BPM.
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 4, sample_time: 2 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeCloseTo(120);
  });

  it('uses only the first and last markers for a healthy array with more than two', () => {
    const markers = [
      { beat_time: 0, sample_time: 0 },
      { beat_time: 1, sample_time: 0.3 }, // ignored - not first or last
      { beat_time: 4, sample_time: 2 },
    ];
    expect(AbletonAdapter.calculateBpmFromWarpMarkers(markers)).toBeCloseTo(120);
  });
});

// PR #49: ensureServerPortFile auto-restores $TMPDIR/ableton-js-server.port at startup
// when macOS's temp cleaner has purged it. Best-effort by contract: it must never throw,
// so a failed restore still falls through to ableton.start's own bounded timeout.
// portFilePath and exec are injected; the real script is never run here.
describe('AbletonAdapter.ensureServerPortFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-port-file-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('does not run the restore script when the port file exists', () => {
    const portFile = path.join(tmpDir, 'ableton-js-server.port');
    fs.writeFileSync(portFile, '49831');
    const exec = vi.fn();

    AbletonAdapter.ensureServerPortFile(portFile, exec);

    expect(exec).not.toHaveBeenCalled();
  });

  it('runs the restore script when the port file is missing and logs its output', () => {
    const infoSpy = vi.spyOn(Logger, 'info');
    const exec = vi.fn().mockReturnValue('Wrote port 49831 to /tmp/x\n');

    AbletonAdapter.ensureServerPortFile(path.join(tmpDir, 'does-not-exist.port'), exec);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toMatch(/restore-ableton-port-file\.sh$/);
    expect(infoSpy).toHaveBeenCalledWith('Port file restore: Wrote port 49831 to /tmp/x');
  });

  it('logs a warning naming the script stderr and does not throw when the script fails', () => {
    const warnSpy = vi.spyOn(Logger, 'warn');
    const scriptError = Object.assign(new Error('Command failed'), {
      stderr: "ERROR: Ableton Live doesn't appear to be running.\n",
    });
    const exec = vi.fn(() => {
      throw scriptError;
    });

    expect(() =>
      AbletonAdapter.ensureServerPortFile(path.join(tmpDir, 'does-not-exist.port'), exec),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ERROR: Ableton Live doesn't appear to be running."),
    );
  });

  it('falls back to the exec error message when there is no stderr (e.g. ENOENT/timeout)', () => {
    const warnSpy = vi.spyOn(Logger, 'warn');
    const exec = vi.fn(() => {
      throw Object.assign(new Error('spawnSync ETIMEDOUT'), { stderr: undefined });
    });

    expect(() =>
      AbletonAdapter.ensureServerPortFile(path.join(tmpDir, 'does-not-exist.port'), exec),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('spawnSync ETIMEDOUT'));
  });
});

// WOW-007C: clampVolume is pure and side-effect-free, so it's tested directly
// off the statically-imported module (no env/mocking seam needed).
describe('AbletonAdapter.clampVolume', () => {
  it('passes a mid-range value through unchanged', () => {
    expect(AbletonAdapter.clampVolume(0.42)).toBeCloseTo(0.42);
  });

  it('clamps negative values to 0', () => {
    expect(AbletonAdapter.clampVolume(-0.5)).toBe(0);
  });

  it('clamps values above the 0.7 pillar ceiling', () => {
    expect(AbletonAdapter.clampVolume(1)).toBeCloseTo(0.7);
    expect(AbletonAdapter.clampVolume(0.7)).toBeCloseTo(0.7);
  });

  it('treats non-finite input (NaN/Infinity) as 0 rather than propagating it', () => {
    expect(AbletonAdapter.clampVolume(NaN)).toBe(0);
    expect(AbletonAdapter.clampVolume(Infinity)).toBe(0);
    expect(AbletonAdapter.clampVolume(-Infinity)).toBe(0);
  });
});

// --- WOW-007C: cauldron drum-rack sample, cauldron volume, idle-timeout
// config, and desired-volume-on-clip-start - all exercised against a fresh,
// per-test module instance (vi.doMock + dynamic import, this repo's vitest
// does not hoist vi.mock). A fresh instance per test is needed here (unlike
// IncomingEvents.test.ts's single shared beforeAll) because:
//   (1) DRUM_RACK_TRACK_INDEX is read from process.env at module load, so
//       different env values need different module instances; and
//   (2) triggerRandomDrumSample is throttled at module scope, so sharing one
//       instance across tests would let one test's throttle window suppress
//       another's call.
//
// This vitest version (0.28.5) only honors the FIRST vi.doMock registration
// for a given dependency module id within a test file - a second
// vi.resetModules() + vi.doMock() pair for the SAME id (e.g. calling doMock
// again for '../../event/OutgoingEvents' inside a later test) is silently
// ignored and keeps resolving to the first test's mock factory, even though
// the module actually under test here (AbletonAdapter itself, never
// doMocked) reliably re-evaluates fresh on every dynamic import - confirmed
// directly: DRUM_RACK_TRACK_INDEX/tracks/the throttled triggerRandomDrumSample
// closure all correctly reset per loadAdapter() call below, but a SECOND
// `vi.doMock('.../OutgoingEvents', ...)` call would silently keep routing
// every subsequent test's AbletonAdapter calls to the FIRST test's emitEvent
// spy, invisible to that later test's own assertions. So OutgoingEvents and
// ableton-js's DeviceParameter are mocked exactly ONCE here (describe-body
// scope, before any test runs) and their call history is cleared per test
// instead of being re-registered - the same "one shared mock, cleared every
// test" shape as IncomingEvents.test.ts's top-level beforeAll spies.
describe('AbletonAdapter WOW-007C (cauldron sample, cauldron volume, idle timeout, desired volumes)', () => {
  const ENV_KEYS = ['DRUM_RACK_TRACK_INDEX'] as const;
  const originalEnv: Record<string, string | undefined> = {};

  const emitEvent = vi.fn();
  const emitEventWithoutResettingTimeout = vi.fn();
  vi.doMock('../../event/OutgoingEvents', () => ({
    OutgoingEvents: { emitEvent, emitEventWithoutResettingTimeout },
  }));

  // ableton-js's real DeviceParameter.set() calls into the real `ableton`
  // instance's setProp, which would hang/throw without a live connection
  // (.start() is never called in tests) - mocked with a plain fake that
  // mirrors the shape AbletonAdapter actually reads (`raw.value`) and writes
  // (`.set('value', x)`), same spirit as fakeTrackVolume in
  // backend/event/test/IncomingEvents.test.ts. Registered once (see the
  // block comment above) - each `new DeviceParameter(...)` call still
  // produces its own independent `set` spy per instance, so per-test
  // isolation of individual calls is unaffected.
  vi.doMock('ableton-js/ns/device-parameter', () => {
    class DeviceParameter {
      raw: { value: number };
      // Deliberately does NOT mutate raw.value: real ableton-js keeps
      // raw.value as the fetch-time snapshot, so a self-updating fake would
      // let tests "prove" read-back freshness the production code doesn't
      // have (general review, PR #56).
      set = vi.fn(async (_key: string, _value: number) => null);
      constructor(_ableton: unknown, raw: { value: number }) {
        this.raw = raw;
      }
    }
    return { DeviceParameter };
  });

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      originalEnv[key] = process.env[key];
    });
    emitEvent.mockClear();
    emitEventWithoutResettingTimeout.mockClear();
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    });
    vi.restoreAllMocks();
  });

  function fakeClip(name: string, fireImpl?: () => Promise<void>): Clip {
    return {
      raw: { name },
      fire: vi.fn(fireImpl ?? (async () => undefined)),
    } as unknown as Clip;
  }

  function fakeClipSlot(clip: Clip | null): ClipSlot {
    return {
      get: vi.fn(async (prop: string) => (prop === 'clip' ? clip : undefined)),
    } as unknown as ClipSlot;
  }

  function fakeMixerDevice(volume: number) {
    return {
      sendCommand: vi.fn(async (cmd: string) =>
        cmd === 'get_volume'
          ? { id: 'vol-id', name: 'Volume', value: volume, is_quantized: false }
          : undefined,
      ),
    };
  }

  function fakeTrack(
    options: { name?: string; clipSlots?: ClipSlot[]; volume?: number } = {},
  ): Track {
    const { name = 'Cauldron', clipSlots = [], volume = 0.6 } = options;
    const mixerDevice = fakeMixerDevice(volume);
    return {
      raw: { name },
      get: vi.fn(async (prop: string) => {
        if (prop === 'clip_slots') return clipSlots;
        if (prop === 'mixer_device') return mixerDevice;
        return undefined;
      }),
    } as unknown as Track;
  }

  async function loadAdapter(env: Record<string, string | undefined> = {}) {
    vi.resetModules();
    ENV_KEYS.forEach((key) => delete process.env[key]);
    Object.entries(env).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });

    const { AbletonAdapter: FreshAdapter } = await import('../AbletonAdapter');
    const { Logger: FreshLogger } = await import('../../util/Logger');
    return {
      AbletonAdapter: FreshAdapter,
      // Same shared, describe-scoped spies every call (see the block comment
      // above) - returned here so existing call sites can keep destructuring
      // `OutgoingEvents` from loadAdapter()'s result unchanged.
      OutgoingEvents: { emitEvent, emitEventWithoutResettingTimeout },
      Logger: FreshLogger,
    };
  }

  describe('DRUM_RACK_TRACK_INDEX env validation', () => {
    it('disables the feature when the env var is unset (NaN)', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: undefined });
      expect(Fresh.isDrumRackTrackIndexValid).toBe(false);
    });

    it('disables the feature for a negative index', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: '-1' });
      expect(Fresh.isDrumRackTrackIndexValid).toBe(false);
    });

    it('disables the feature for a non-integer index', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: '4.5' });
      expect(Fresh.isDrumRackTrackIndexValid).toBe(false);
    });

    // NOTE: the module-eval startup warning itself is not asserted — this
    // file deliberately leaves the pino Logger unmocked, and the warn fires
    // during dynamic import, before any spy could attach. The previous
    // "expect(warn).toBeDefined()" test was vacuous (general review, PR #56)
    // and was removed; the observable disabled-state contract is covered by
    // the isDrumRackTrackIndexValid assertions in this describe block.

    it('enables the feature for a valid non-negative integer index', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: '4' });
      expect(Fresh.isDrumRackTrackIndexValid).toBe(true);
      expect(Fresh.DRUM_RACK_TRACK_INDEX).toBe(4);
    });

    it('a disabled feature: getDrumRackClips returns [] without touching tracks (the startup warning already covered the "why")', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: undefined });

      const clips = await Fresh.getDrumRackClips();

      expect(clips).toEqual([]);
      expect(Fresh.drumRackClips).toEqual([]);
    });

    it('a disabled feature: getCauldronVolume returns the 0.6 default', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: undefined });
      await expect(Fresh.getCauldronVolume()).resolves.toBe(0.6);
    });

    it('a disabled feature: setCauldronVolume warns and does not throw', async () => {
      const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: undefined,
      });
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);

      await expect(Fresh.setCauldronVolume(0.5)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('a disabled feature: triggerRandomDrumSample warns and does not throw', async () => {
      const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: undefined,
      });
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);

      await expect(Fresh.triggerRandomDrumSample()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No cauldron/drum-rack clips available'),
      );
    });
  });

  describe('getDrumRackClips', () => {
    it('filters out empty clip slots and keeps only non-null clips, logging the count and track name', async () => {
      const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const infoSpy = vi.spyOn(FreshLogger, 'info').mockImplementation(() => undefined as never);
      const kick = fakeClip('Kick 1');
      const snare = fakeClip('Snare 1');
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({
          name: 'Cauldron Drums',
          clipSlots: [fakeClipSlot(kick), fakeClipSlot(null), fakeClipSlot(snare)],
        }),
      );

      const clips = await Fresh.getDrumRackClips();

      expect(clips).toEqual([kick, snare]);
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('2 clip(s)'));
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Cauldron Drums'));
    });

    it('warns and returns [] when the configured track index is beyond the fetched tracks', async () => {
      const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);
      // Only 2 tracks fetched - index 4 doesn't exist.
      Fresh.tracks.push({} as Track, {} as Track);

      const clips = await Fresh.getDrumRackClips();

      expect(clips).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });
  });

  describe('triggerRandomDrumSample', () => {
    it('fires before emitting (fire-then-emit ordering) and broadcasts the fired clip name', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const callOrder: string[] = [];
      const clip = fakeClip('Kick 1', async () => {
        callOrder.push('fire');
      });
      OutgoingEvents.emitEvent.mockImplementation(() => callOrder.push('emit'));
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({ clipSlots: [fakeClipSlot(clip)] }),
      );
      await Fresh.getDrumRackClips();

      await Fresh.triggerRandomDrumSample();

      expect(callOrder).toEqual(['fire', 'emit']);
      expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith('cauldron_sample_triggered', {
        clipName: 'Kick 1',
      });
    });

    it('with an empty cache, refetches once from tracks before firing', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const clip = fakeClip('Snare 1');
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({ clipSlots: [fakeClipSlot(clip)] }),
      );
      expect(Fresh.drumRackClips).toBeNull();

      await Fresh.triggerRandomDrumSample();

      expect(clip.fire).toHaveBeenCalledTimes(1);
      expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith('cauldron_sample_triggered', {
        clipName: 'Snare 1',
      });
    });

    it('warns and does not emit or throw when the cache is empty even after a refetch attempt', async () => {
      const {
        AbletonAdapter: Fresh,
        OutgoingEvents,
        Logger: FreshLogger,
      } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);
      // Track exists but has no clips at all.
      Fresh.tracks.push({} as Track, {} as Track, {} as Track, {} as Track, fakeTrack());

      await expect(Fresh.triggerRandomDrumSample()).resolves.toBeUndefined();

      expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No cauldron/drum-rack clips available'),
      );
    });

    it('on a fire failure, logs the error, refetches the cache for next time, and does not emit or throw', async () => {
      const {
        AbletonAdapter: Fresh,
        OutgoingEvents,
        Logger: FreshLogger,
      } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const errorSpy = vi.spyOn(FreshLogger, 'error').mockImplementation(() => undefined as never);
      const failingClip = fakeClip('Broken Hat', async () => {
        throw new Error('fire boom');
      });
      const replacementClip = fakeClip('Fresh Hat');
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({ clipSlots: [fakeClipSlot(failingClip)] }),
      );
      await Fresh.getDrumRackClips();
      // Swap in a healthy clip so the post-failure refetch is observable.
      (Fresh.tracks[4] as unknown as { get: ReturnType<typeof vi.fn> }).get = vi.fn(
        async (prop: string) => {
          if (prop === 'clip_slots') return [fakeClipSlot(replacementClip)];
          return undefined;
        },
      );

      await expect(Fresh.triggerRandomDrumSample()).resolves.toBeUndefined();

      expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Broken Hat'),
      );
      expect(Fresh.drumRackClips).toEqual([replacementClip]);
    });

    it('throttles: a second tap within 200ms is dropped (fire called only once)', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter({
          DRUM_RACK_TRACK_INDEX: '4',
        });
        const clip = fakeClip('Kick 1');
        Fresh.tracks.push(
          {} as Track,
          {} as Track,
          {} as Track,
          {} as Track,
          fakeTrack({ clipSlots: [fakeClipSlot(clip)] }),
        );
        await Fresh.getDrumRackClips();

        Fresh.triggerRandomDrumSample();
        Fresh.triggerRandomDrumSample();
        await vi.runOnlyPendingTimersAsync();

        expect(clip.fire).toHaveBeenCalledTimes(1);
        expect(OutgoingEvents.emitEvent).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('cauldron volume', () => {
    it('getCauldronVolume reads the drum-rack track mixer volume', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: '4' });
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({ volume: 0.55 }),
      );

      await expect(Fresh.getCauldronVolume()).resolves.toBeCloseTo(0.55);
    });

    it('getCauldronVolume falls back to 0.6 when the track is missing', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter({ DRUM_RACK_TRACK_INDEX: '4' });
      // No tracks fetched at all.
      await expect(Fresh.getCauldronVolume()).resolves.toBe(0.6);
    });

    it('setCauldronVolume clamps to [0, 0.7] and broadcasts cauldron_volume_changed', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      Fresh.tracks.push(
        {} as Track,
        {} as Track,
        {} as Track,
        {} as Track,
        fakeTrack({ volume: 0.4 }),
      );

      await Fresh.setCauldronVolume(5); // way above ceiling

      expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith('cauldron_volume_changed', {
        volume: 0.7,
      });
      // Read-back returns the fetch-time SNAPSHOT (0.4), not the value just
      // set — raw.value is not a live read in ableton-js. Clients get
      // freshness from the cauldron_volume_changed broadcast asserted above,
      // not from re-fetching (general review, PR #56).
      await expect(Fresh.getCauldronVolume()).resolves.toBeCloseTo(0.4);
    });

    it('setCauldronVolume warns and does not throw when the track is missing', async () => {
      const {
        AbletonAdapter: Fresh,
        OutgoingEvents,
        Logger: FreshLogger,
      } = await loadAdapter({
        DRUM_RACK_TRACK_INDEX: '4',
      });
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);

      await expect(Fresh.setCauldronVolume(0.5)).resolves.toBeUndefined();

      expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('idle timeout config', () => {
    it('defaults to enabled, 3 minutes', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      expect(Fresh.getIdleTimeoutConfig()).toEqual({ enabled: true, timeoutMs: 3 * 60 * 1000 });
    });

    // Behavioural assertions rather than vi.getTimerCount(): the global
    // fake-timer count picks up stray environment timers (pino, throttle
    // internals, worker reuse) and flaked in review (general review, PR #56
    // — "expected 3 to be 2"). What matters is what FIRES, not how many
    // timers exist.
    it('accepts a valid config, broadcasts it, and the warning fires on schedule', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();

        const result = Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 });

        expect(result).toEqual({ enabled: true, timeoutMs: 60_000 });
        expect(Fresh.getIdleTimeoutConfig()).toEqual({ enabled: true, timeoutMs: 60_000 });
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
          'idle_timeout_changed',
          { enabled: true, timeoutMs: 60_000 },
        );

        // The timers only act while something is playing (shouldShowTimeout).
        Fresh.playingClips[0] = { clipName: 'Idle Test Clip', pillar: 0 } as never;
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        // Warning arms at timeoutMs - 30s = 30s with this config.
        vi.advanceTimersByTime(30_000);
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('disabling clears any armed timers (nothing fires after the deadline)', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
        Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 });

        Fresh.setIdleTimeoutConfig({ enabled: false, timeoutMs: 60_000 });
        expect(Fresh.getIdleTimeoutConfig().enabled).toBe(false);

        // With clips playing and the full timeout elapsed twice over, a stale
        // armed timer would emit timeout_warning — nothing may fire.
        Fresh.playingClips[0] = { clipName: 'Idle Test Clip', pillar: 0 } as never;
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        vi.advanceTimersByTime(120_000);
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).not.toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([
      ['below the 60s minimum', 59_999],
      ['above the 60min maximum', 60 * 60 * 1000 + 1],
      ['non-integer', 60_000.5],
    ])(
      'ignores an out-of-bounds timeoutMs (%s) and logs a warning, leaving config unchanged',
      async (_label, badTimeoutMs) => {
        const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter();
        const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);
        const before = Fresh.getIdleTimeoutConfig();

        const result = Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: badTimeoutMs });

        expect(result).toEqual(before);
        expect(Fresh.getIdleTimeoutConfig()).toEqual(before);
        expect(warnSpy).toHaveBeenCalled();
      },
    );

    it('accepts the exact bounds (60s and 60min)', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      expect(Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 })).toEqual({
        enabled: true,
        timeoutMs: 60_000,
      });
      expect(Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60 * 60 * 1000 })).toEqual({
        enabled: true,
        timeoutMs: 60 * 60 * 1000,
      });
    });
  });

  // WOW-007C item 4: DJ mode must suppress the idle-timeout handover to the
  // Live-set attractor for as long as it's active, and stop suppressing it
  // the moment it ends, by ANY path (explicit exit, walk-away auto-exit, a
  // reconnect that re-asserts play mode).
  describe('DJ mode (WOW-007C item 4)', () => {
    it('defaults to inactive', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      expect(Fresh.getDjModeActive()).toBe(false);
    });

    it('activating broadcasts dj_mode_changed via emitEventWithoutResettingTimeout', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();

      const result = Fresh.setDjModeActive(true);

      expect(result).toBe(true);
      expect(Fresh.getDjModeActive()).toBe(true);
      expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
        'dj_mode_changed',
        { active: true },
      );
    });

    // Behavioural, not vi.getTimerCount() (same posture as the idle-timeout
    // config tests above, general review PR #56): what matters is that
    // nothing FIRES while DJ mode is active, not how many timers exist.
    it('activating clears an already-armed timer and blocks new arming — no timeout_warning fires even past the deadline', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
        Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 });
        Fresh.playingClips[0] = { clipName: 'DJ Mode Test Clip', pillar: 0 } as never;

        Fresh.setDjModeActive(true);
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        // Twice over the configured timeout — a stale armed timer would fire
        // both the warning and the timeout handler in that span.
        vi.advanceTimersByTime(120_000);

        expect(OutgoingEvents.emitEventWithoutResettingTimeout).not.toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('deactivating re-arms the timers: the warning fires on schedule again', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
        Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 });
        Fresh.setDjModeActive(true);

        Fresh.setDjModeActive(false);
        Fresh.playingClips[0] = { clipName: 'DJ Mode Test Clip', pillar: 0 } as never;
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        // Warning arms at timeoutMs - 30s = 30s with this config.
        vi.advanceTimersByTime(30_000);

        expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores a non-boolean payload, leaves state unchanged, and logs a warning', async () => {
      const { AbletonAdapter: Fresh, Logger: FreshLogger } = await loadAdapter();
      const warnSpy = vi.spyOn(FreshLogger, 'warn').mockImplementation(() => undefined as never);

      const result = Fresh.setDjModeActive('yes' as never);

      expect(result).toBe(false);
      expect(Fresh.getDjModeActive()).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });

    // Audio-ableton delta review finding 1: the suppression's recovery chain
    // (walk-away auto-exit -> set_dj_mode false) lives in the frontend, so a
    // dead last UI must not leave the attractor handover suppressed forever.
    it('handleLastWebClientDisconnected lifts an active suppression: broadcasts and the warning fires on schedule again', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
        Fresh.setIdleTimeoutConfig({ enabled: true, timeoutMs: 60_000 });
        Fresh.setDjModeActive(true);

        Fresh.handleLastWebClientDisconnected();

        expect(Fresh.getDjModeActive()).toBe(false);
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
          'dj_mode_changed',
          { active: false },
        );
        Fresh.playingClips[0] = { clipName: 'DJ Mode Test Clip', pillar: 0 } as never;
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        vi.advanceTimersByTime(30_000);
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('handleLastWebClientDisconnected is a no-op while DJ mode is inactive: no broadcast', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();

      Fresh.handleLastWebClientDisconnected();

      expect(Fresh.getDjModeActive()).toBe(false);
      expect(OutgoingEvents.emitEventWithoutResettingTimeout).not.toHaveBeenCalledWith(
        'dj_mode_changed',
        expect.anything(),
      );
    });

    it('an idle timeout still armed while disabled stays disabled across a DJ mode transition (interaction with idleTimeoutEnabled)', async () => {
      vi.useFakeTimers();
      try {
        const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
        Fresh.setIdleTimeoutConfig({ enabled: false, timeoutMs: 60_000 });
        Fresh.playingClips[0] = { clipName: 'DJ Mode Test Clip', pillar: 0 } as never;

        Fresh.setDjModeActive(true);
        Fresh.setDjModeActive(false);
        OutgoingEvents.emitEventWithoutResettingTimeout.mockClear();
        vi.advanceTimersByTime(120_000);

        // idleTimeoutEnabled is still false, so DJ mode ending must not
        // resurrect a timeout the DJ separately turned off.
        expect(OutgoingEvents.emitEventWithoutResettingTimeout).not.toHaveBeenCalledWith(
          'timeout_warning',
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('desired volumes respected at clip start', () => {
    it('resolveClipStartVolume falls back to 0.6 for a pillar whose volume was never explicitly set', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      expect(Fresh.resolveClipStartVolume(0)).toBe(0.6);
    });

    it('setTrackVolume records the clamped value, and resolveClipStartVolume then returns it', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      const param = { raw: { value: 0 }, set: vi.fn(async () => null) };
      Fresh.trackVolumes.push(
        undefined as never,
        undefined as never,
        param as never,
        undefined as never,
      );

      await Fresh.setTrackVolume(2, 5); // above the 0.7 ceiling

      expect(Fresh.resolveClipStartVolume(2)).toBeCloseTo(0.7);
      expect(param.set).toHaveBeenCalledWith('value', 0.7);
    });

    it('setTrackVolume clamps and emits the clamped volume, not the raw input', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
      const param = { raw: { value: 0 }, set: vi.fn(async () => null) };
      Fresh.trackVolumes.push(param as never);

      await Fresh.setTrackVolume(0, -1); // below the 0 floor

      expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith('volume_changed', {
        pillar: 0,
        volume: 0,
      });
    });

    it('other pillars keep their own 0.6 fallback after only one pillar has an explicit volume', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      const param = { raw: { value: 0 }, set: vi.fn(async () => null) };
      Fresh.trackVolumes.push(param as never);

      await Fresh.setTrackVolume(0, 0.3);

      expect(Fresh.resolveClipStartVolume(0)).toBeCloseTo(0.3);
      expect(Fresh.resolveClipStartVolume(1)).toBe(0.6);
      expect(Fresh.resolveClipStartVolume(2)).toBe(0.6);
      expect(Fresh.resolveClipStartVolume(3)).toBe(0.6);
    });
  });

  describe('rebuildPillarPlayingState (WOW-007C — restart amnesia fix)', () => {
    // A real clip name from Music Database.csv so the metadata lookup
    // succeeds without mocking MusicDatabaseService.
    const KNOWN_CLIP_NAME = 'Mizbiz vox 3B 86';

    function trackWithPlayingSlot(slotIndex: number | undefined) {
      return {
        raw: { name: 'Pillar 1' },
        get: vi.fn(async (prop: string) => (prop === 'playing_slot_index' ? slotIndex : undefined)),
      } as never;
    }

    it('rebuilds playingClips from the current slot index, state-only (no emissions, no volume writes)', async () => {
      const { AbletonAdapter: Fresh, OutgoingEvents } = await loadAdapter();
      const clip = fakeClip(KNOWN_CLIP_NAME);

      await Fresh.rebuildPillarPlayingState(0, trackWithPlayingSlot(0), [clip]);

      expect(Fresh.playingClips[0]).toMatchObject({ clipName: KNOWN_CLIP_NAME, pillar: 0 });
      expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
      expect(OutgoingEvents.emitEventWithoutResettingTimeout).not.toHaveBeenCalled();
    });

    it('leaves state untouched when nothing is playing (slot index -1)', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();

      await Fresh.rebuildPillarPlayingState(0, trackWithPlayingSlot(-1), [
        fakeClip(KNOWN_CLIP_NAME),
      ]);

      expect(Fresh.playingClips[0]).toBeFalsy();
    });

    it('never clobbers state a listener already built (re-run safety)', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      const existing = { clipName: 'Listener Built', pillar: 0 } as never;
      Fresh.playingClips[0] = existing;

      await Fresh.rebuildPillarPlayingState(0, trackWithPlayingSlot(0), [
        fakeClip(KNOWN_CLIP_NAME),
      ]);

      expect(Fresh.playingClips[0]).toBe(existing);
    });

    it('warns and leaves state empty for a clip name missing from the database', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();

      await Fresh.rebuildPillarPlayingState(0, trackWithPlayingSlot(0), [
        fakeClip('Not In The CSV At All'),
      ]);

      expect(Fresh.playingClips[0]).toBeFalsy();
    });

    it('catches a failing track read without throwing (startup must not be blocked)', async () => {
      const { AbletonAdapter: Fresh } = await loadAdapter();
      const failingTrack = {
        raw: { name: 'Pillar 1' },
        get: vi.fn(async () => {
          throw new Error('ableton unreachable');
        }),
      } as never;

      await expect(
        Fresh.rebuildPillarPlayingState(0, failingTrack, [fakeClip(KNOWN_CLIP_NAME)]),
      ).resolves.toBeUndefined();
      expect(Fresh.playingClips[0]).toBeFalsy();
    });
  });
});
