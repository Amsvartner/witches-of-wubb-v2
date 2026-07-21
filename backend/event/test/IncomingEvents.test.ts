import { vi } from 'vitest';
import type { Socket } from 'socket.io';
import type { RequestInfo } from 'node-osc';
import type { DeviceParameter } from 'ableton-js/ns/device-parameter';
import { MusicDatabaseService } from '../../service/MusicDatabaseService';
import { Logger } from '../../util/Logger';
import { ClipTypes } from '../../type/ClipTypes';
import { ClipMetadataType } from '../../type/ClipMetadataType';

// vi.mock auto-hoisting is not active in this vitest setup (same constraint
// documented in src/context/hook/test/useSocketContextProviderState.test.tsx),
// so AbletonAdapter/OutgoingEvents are registered with vi.doMock and
// IncomingEvents is imported dynamically afterward so it resolves the mocked
// modules instead of the real ones - this file never loads ableton-js's real
// client or touches a socket/network. MusicDatabaseService is left real: its
// CSV read is wrapped in try/catch and fails harmlessly outside backend/'s own
// cwd, and rfidToClipMap is a plain mutable object we can seed directly.
let IncomingEvents: typeof import('../IncomingEvents')['IncomingEvents'];
let AbletonAdapter: typeof import('../../adapter/AbletonAdapter')['AbletonAdapter'];
let OutgoingEvents: typeof import('../OutgoingEvents')['OutgoingEvents'];

beforeAll(async () => {
  vi.doMock('../../adapter/AbletonAdapter', () => ({
    AbletonAdapter: {
      queueClip: vi.fn(),
      stopOrRemoveClipFromQueue: vi.fn(() => Promise.resolve()),
      getTempo: vi.fn(),
      getTrackVolumes: vi.fn(),
      setTrackVolume: vi.fn(),
      trackVolumes: [] as DeviceParameter[],
      // WOW-007C
      triggerRandomDrumSample: vi.fn(() => Promise.resolve()),
      DEFAULT_TRACK_VOLUME: 0.6,
      getCauldronVolume: vi.fn(),
      setCauldronVolume: vi.fn(() => Promise.resolve()),
      getIdleTimeoutConfig: vi.fn(),
      setIdleTimeoutConfig: vi.fn(),
      // WOW-007C item 4
      setDjModeActive: vi.fn(),
    },
  }));
  vi.doMock('../OutgoingEvents', () => ({
    OutgoingEvents: {
      emitEvent: vi.fn(),
      emitEventWithoutResetingTimout: vi.fn(),
    },
  }));

  ({ IncomingEvents } = await import('../IncomingEvents'));
  ({ AbletonAdapter } = await import('../../adapter/AbletonAdapter'));
  ({ OutgoingEvents } = await import('../OutgoingEvents'));
});

vi.spyOn(Logger, 'info').mockImplementation(() => undefined as unknown as void);
const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined as unknown as void);
const errorSpy = vi.spyOn(Logger, 'error').mockImplementation(() => undefined as unknown as void);

// IncomingEvents.ts's own frozen pillar map (must not change here - see
// docs/CODING_GUIDELINES.md). 192.168.0.101 is pillar 0: a real, valid,
// falsy index - the case the `pillar === undefined` guard must not confuse
// with "unmapped IP".
const KNOWN_PILLAR_0_IP = '192.168.0.101';
const KNOWN_PILLAR_2_IP = '192.168.0.103';
const UNKNOWN_IP = '10.0.0.250';

function fakeRinfo(address: string): RequestInfo {
  return { address, family: 'IPv4', port: 12345, size: 0 };
}

function fakeClipMetadata(): Omit<ClipMetadataType, 'rfid'> {
  return {
    clipName: 'Test Clip 120',
    type: ClipTypes.Melody,
    assetName: 'test-clip.png',
  };
}

// Only `.raw.value` is read by the code under test; the rest of ableton-js's
// RawDeviceParameter shape is irrelevant here (same irrelevant-field-cast
// pattern as WOW-015's fakeClip() in PhraseLeaderService.test.ts).
function fakeTrackVolume(value: number): DeviceParameter {
  return { raw: { value } } as unknown as DeviceParameter;
}

// AbletonAdapter.trackVolumes is getter-only on the real module (a live-binding
// getter with no setter), and vitest's mock preserves that accessor shape - so
// tests mutate the array in place rather than reassigning the property.
function setTrackVolumes(...values: DeviceParameter[]) {
  AbletonAdapter.trackVolumes.length = 0;
  AbletonAdapter.trackVolumes.push(...values);
}

function createHandlerRegistry() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const socket = {
    on: (event: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(event, handler);
    },
  } as unknown as Socket;
  IncomingEvents.addSocketEventsHandlers(socket);
  return handlers;
}

beforeEach(() => {
  vi.clearAllMocks();
  setTrackVolumes();
  vi.mocked(AbletonAdapter.stopOrRemoveClipFromQueue).mockResolvedValue(undefined);
});

afterEach(() => {
  Object.keys(MusicDatabaseService.rfidToClipMap).forEach((key) => {
    delete MusicDatabaseService.rfidToClipMap[key];
  });
});

describe('get_tempo (WOW-014 crash-hardening)', () => {
  it('calls back with the tempo on success', async () => {
    vi.mocked(AbletonAdapter.getTempo).mockResolvedValueOnce(128);
    const callback = vi.fn();

    await createHandlerRegistry().get('get_tempo')!(undefined, callback);

    expect(callback).toHaveBeenCalledWith(128);
  });

  it('logs and does not throw when AbletonAdapter.getTempo rejects', async () => {
    const error = new Error('ableton unreachable');
    vi.mocked(AbletonAdapter.getTempo).mockRejectedValueOnce(error);
    const callback = vi.fn();

    await expect(
      createHandlerRegistry().get('get_tempo')!(undefined, callback),
    ).resolves.toBeUndefined();

    expect(callback).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(error, 'Error getting tempo');
  });
});

describe('get_track_volumes (WOW-014 crash-hardening)', () => {
  it('calls back with formatted volumes without re-fetching when already cached', async () => {
    setTrackVolumes(fakeTrackVolume(80), fakeTrackVolume(45));
    const callback = vi.fn();

    await createHandlerRegistry().get('get_track_volumes')!(undefined, callback);

    expect(AbletonAdapter.getTrackVolumes).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith([80, 45]);
  });

  it('logs and does not throw when AbletonAdapter.getTrackVolumes rejects', async () => {
    setTrackVolumes();
    const error = new Error('ableton unreachable');
    vi.mocked(AbletonAdapter.getTrackVolumes).mockRejectedValueOnce(error);
    const callback = vi.fn();

    await expect(
      createHandlerRegistry().get('get_track_volumes')!(undefined, callback),
    ).resolves.toBeUndefined();

    expect(callback).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(error, 'Error getting track volumes');
  });
});

describe('set_track_volume (WOW-014 crash-hardening)', () => {
  it('sets the volume on success', async () => {
    await createHandlerRegistry().get('set_track_volume')!({ pillar: 2, volume: 60 });

    expect(AbletonAdapter.setTrackVolume).toHaveBeenCalledWith(2, 60);
  });

  it('logs and does not throw when AbletonAdapter.setTrackVolume rejects', async () => {
    const error = new Error('ableton unreachable');
    vi.mocked(AbletonAdapter.setTrackVolume).mockRejectedValueOnce(error);

    await expect(
      createHandlerRegistry().get('set_track_volume')!({ pillar: 2, volume: 60 }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(error, 'Error setting track volume for pillar 3');
  });
});

describe('handleNewTag pillar guard (WOW-017)', () => {
  it('pillar 0 (falsy but valid) proceeds normally - does not trip the unknown-IP guard', () => {
    const rfid = 'rfid-pillar-0';
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();

    IncomingEvents.oscEventHandlers(['/new/tag', rfid], fakeRinfo(KNOWN_PILLAR_0_IP));

    expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith(
      'ingredient_detected',
      expect.objectContaining({ pillar: 0, rfid }),
    );
    expect(AbletonAdapter.queueClip).toHaveBeenCalledWith(expect.objectContaining({ rfid }), 0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a known non-zero pillar also proceeds normally (control case)', () => {
    const rfid = 'rfid-pillar-2';
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();

    IncomingEvents.oscEventHandlers(['/new/tag', rfid], fakeRinfo(KNOWN_PILLAR_2_IP));

    expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith(
      'ingredient_detected',
      expect.objectContaining({ pillar: 2, rfid }),
    );
    expect(AbletonAdapter.queueClip).toHaveBeenCalledWith(expect.objectContaining({ rfid }), 2);
  });

  it('an unrecognized IP trips the guard: exactly one warning, no emission, no AbletonAdapter call', () => {
    const rfid = 'rfid-unknown-ip';
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();

    IncomingEvents.oscEventHandlers(['/new/tag', rfid], fakeRinfo(UNKNOWN_IP));

    expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
    expect(AbletonAdapter.queueClip).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(UNKNOWN_IP));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs the error object (not a bare string) when the handler throws', () => {
    const rfid = 'rfid-throws';
    const error = new Error('queueClip boom');
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();
    vi.mocked(AbletonAdapter.queueClip).mockImplementationOnce(() => {
      throw error;
    });

    IncomingEvents.oscEventHandlers(['/new/tag', rfid], fakeRinfo(KNOWN_PILLAR_0_IP));

    expect(errorSpy).toHaveBeenCalledWith(error, expect.stringContaining(rfid));
  });
});

describe('handleDepartedTag pillar guard (WOW-017)', () => {
  it('pillar 0 (falsy but valid) proceeds normally - does not trip the unknown-IP guard', () => {
    const rfid = 'rfid-pillar-0-departed';
    const clip = fakeClipMetadata();
    MusicDatabaseService.rfidToClipMap[rfid] = clip;

    IncomingEvents.oscEventHandlers(['/departed/tag', rfid], fakeRinfo(KNOWN_PILLAR_0_IP));

    expect(OutgoingEvents.emitEvent).toHaveBeenCalledWith(
      'ingredient_removed',
      expect.objectContaining({ pillar: 0 }),
    );
    expect(AbletonAdapter.stopOrRemoveClipFromQueue).toHaveBeenCalledWith(clip.clipName, 0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('an unrecognized IP trips the guard: exactly one warning, no emission, no AbletonAdapter call', () => {
    const rfid = 'rfid-unknown-ip-departed';
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();

    IncomingEvents.oscEventHandlers(['/departed/tag', rfid], fakeRinfo(UNKNOWN_IP));

    expect(OutgoingEvents.emitEvent).not.toHaveBeenCalled();
    expect(AbletonAdapter.stopOrRemoveClipFromQueue).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(UNKNOWN_IP));
  });

  it('logs the error object when AbletonAdapter.stopOrRemoveClipFromQueue rejects for a known pillar', async () => {
    const rfid = 'rfid-stop-rejects';
    MusicDatabaseService.rfidToClipMap[rfid] = fakeClipMetadata();
    const error = new Error('stop boom');
    vi.mocked(AbletonAdapter.stopOrRemoveClipFromQueue).mockRejectedValueOnce(error);

    IncomingEvents.oscEventHandlers(['/departed/tag', rfid], fakeRinfo(KNOWN_PILLAR_0_IP));

    const returnedPromise = vi.mocked(AbletonAdapter.stopOrRemoveClipFromQueue).mock.results[0]
      .value;
    await expect(returnedPromise).rejects.toBe(error);

    expect(errorSpy).toHaveBeenCalledWith(error, expect.stringContaining('pillar 1'));
  });
});

describe('trigger_cauldron_sample (WOW-007C, WOW-014 crash-hardening)', () => {
  it('calls AbletonAdapter.triggerRandomDrumSample on success', async () => {
    await createHandlerRegistry().get('trigger_cauldron_sample')!();

    expect(AbletonAdapter.triggerRandomDrumSample).toHaveBeenCalledTimes(1);
  });

  it('logs and does not throw when AbletonAdapter.triggerRandomDrumSample rejects', async () => {
    const error = new Error('fire boom');
    vi.mocked(AbletonAdapter.triggerRandomDrumSample).mockRejectedValueOnce(error);

    await expect(
      createHandlerRegistry().get('trigger_cauldron_sample')!(),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(error, 'Error triggering cauldron sample');
  });
});

describe('get_cauldron_volume (WOW-007C, WOW-014 crash-hardening)', () => {
  it('calls back with the cauldron volume on success', async () => {
    vi.mocked(AbletonAdapter.getCauldronVolume).mockResolvedValueOnce(0.42);
    const callback = vi.fn();

    await createHandlerRegistry().get('get_cauldron_volume')!(undefined, callback);

    expect(callback).toHaveBeenCalledWith(0.42);
  });

  it('logs and calls back with the 0.6 default when AbletonAdapter.getCauldronVolume rejects', async () => {
    const error = new Error('ableton unreachable');
    vi.mocked(AbletonAdapter.getCauldronVolume).mockRejectedValueOnce(error);
    const callback = vi.fn();

    await expect(
      createHandlerRegistry().get('get_cauldron_volume')!(undefined, callback),
    ).resolves.toBeUndefined();

    expect(callback).toHaveBeenCalledWith(0.6);
    expect(errorSpy).toHaveBeenCalledWith(error, 'Error getting cauldron volume');
  });
});

describe('set_cauldron_volume (WOW-007C, WOW-014 crash-hardening)', () => {
  it('sets the cauldron volume on success', async () => {
    await createHandlerRegistry().get('set_cauldron_volume')!({ volume: 0.5 });

    expect(AbletonAdapter.setCauldronVolume).toHaveBeenCalledWith(0.5);
  });

  it('logs and does not throw when AbletonAdapter.setCauldronVolume rejects', async () => {
    const error = new Error('ableton unreachable');
    vi.mocked(AbletonAdapter.setCauldronVolume).mockRejectedValueOnce(error);

    await expect(
      createHandlerRegistry().get('set_cauldron_volume')!({ volume: 0.5 }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(error, 'Error setting cauldron volume');
  });
});

describe('get_idle_timeout (WOW-007C, WOW-014 crash-hardening)', () => {
  it('calls back with the idle timeout config on success', () => {
    vi.mocked(AbletonAdapter.getIdleTimeoutConfig).mockReturnValueOnce({
      enabled: true,
      timeoutMs: 180000,
    });
    const callback = vi.fn();

    createHandlerRegistry().get('get_idle_timeout')!(undefined, callback);

    expect(callback).toHaveBeenCalledWith({ enabled: true, timeoutMs: 180000 });
  });

  it('logs and acks the default config when AbletonAdapter.getIdleTimeoutConfig throws', () => {
    const error = new Error('boom');
    vi.mocked(AbletonAdapter.getIdleTimeoutConfig).mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    expect(() =>
      createHandlerRegistry().get('get_idle_timeout')!(undefined, callback),
    ).not.toThrow();

    // Same posture as get_cauldron_volume: the UI gets a sane default rather
    // than a callback that never fires (general review, PR #56).
    expect(callback).toHaveBeenCalledWith({ enabled: true, timeoutMs: 3 * 60 * 1000 });
    expect(errorSpy).toHaveBeenCalledWith(error, 'Error getting idle timeout config');
  });
});

describe('set_idle_timeout (WOW-007C, WOW-014 crash-hardening)', () => {
  it('applies the config and calls back with the result on success', () => {
    const config = { enabled: false, timeoutMs: 60000 };
    vi.mocked(AbletonAdapter.setIdleTimeoutConfig).mockReturnValueOnce(config);
    const callback = vi.fn();

    createHandlerRegistry().get('set_idle_timeout')!(config, callback);

    expect(AbletonAdapter.setIdleTimeoutConfig).toHaveBeenCalledWith(config);
    expect(callback).toHaveBeenCalledWith(config);
  });

  it('tolerates a missing callback (fire-and-forget callers)', () => {
    const config = { enabled: true, timeoutMs: 90000 };
    vi.mocked(AbletonAdapter.setIdleTimeoutConfig).mockReturnValueOnce(config);

    expect(() => createHandlerRegistry().get('set_idle_timeout')!(config)).not.toThrow();
  });

  it('logs and does not throw when AbletonAdapter.setIdleTimeoutConfig throws', () => {
    const error = new Error('boom');
    vi.mocked(AbletonAdapter.setIdleTimeoutConfig).mockImplementationOnce(() => {
      throw error;
    });
    const callback = vi.fn();

    expect(() =>
      createHandlerRegistry().get('set_idle_timeout')!(
        { enabled: true, timeoutMs: 60000 },
        callback,
      ),
    ).not.toThrow();

    expect(callback).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(error, 'Error setting idle timeout config');
  });
});

describe('set_dj_mode (WOW-007C item 4, WOW-014 crash-hardening)', () => {
  it('applies the DJ mode state on success', () => {
    createHandlerRegistry().get('set_dj_mode')!({ active: true });

    expect(AbletonAdapter.setDjModeActive).toHaveBeenCalledWith(true);
  });

  it('has no ack callback (fire-and-forget, frozen contract)', () => {
    expect(() => createHandlerRegistry().get('set_dj_mode')!({ active: false })).not.toThrow();
  });

  it('logs and does not throw when AbletonAdapter.setDjModeActive throws', () => {
    const error = new Error('boom');
    vi.mocked(AbletonAdapter.setDjModeActive).mockImplementationOnce(() => {
      throw error;
    });

    expect(() => createHandlerRegistry().get('set_dj_mode')!({ active: true })).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(error, 'Error setting DJ mode');
  });

  // Copilot review, PR #58: parameter-position destructuring would throw on
  // a null/missing payload BEFORE the try/catch — the payload is now pulled
  // apart inside the handler, so the adapter's non-boolean guard sees
  // undefined instead.
  it('does not throw on a null or missing payload; forwards undefined to the adapter guard', () => {
    const registry = createHandlerRegistry();

    expect(() => registry.get('set_dj_mode')!(null)).not.toThrow();
    expect(() => registry.get('set_dj_mode')!(undefined)).not.toThrow();

    expect(AbletonAdapter.setDjModeActive).toHaveBeenCalledWith(undefined);
  });
});
