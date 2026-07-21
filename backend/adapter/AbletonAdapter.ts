import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { Ableton } from 'ableton-js';
import { Track } from 'ableton-js/ns/track';
import { Clip } from 'ableton-js/ns/clip';
import { DeviceParameter } from 'ableton-js/ns/device-parameter';
import * as socketio from 'socket.io';
import * as nodeOSC from 'node-osc';
import throttle from 'lodash.throttle';
import memoize from 'lodash.memoize';
import { Logger } from '../util/Logger';
import { ClipNameUtil } from '../util/ClipNameUtil';
import { PhraseLeaderService } from '../service/PhraseLeaderService';
import { ClipBoard } from '../type/ClipBoard';
import { ClipInfo } from '../type/ClipInfo';
import { ClipList } from '../type/ClipList';
import { ClipMetadataType } from '../type/ClipMetadataType';
import { ClipTypes } from '../type/ClipTypes';
import { IdleTimeoutConfigType } from '../type/IdleTimeoutConfigType';
import { Maybe } from '../type/Maybe';
import { WarpMarker } from '../type/WarpMarker';

import { OutgoingEvents } from '../event/OutgoingEvents';
import { IncomingEvents } from '../event/IncomingEvents';
import { MusicDatabaseService } from '../service/MusicDatabaseService';
import { KeyTranspositionService } from '../service/KeyTranspositionService';

let oscServer: nodeOSC.Server;
const sockets: socketio.Socket[] = [];
// WOW-007C: the fixed 3-minute const became a runtime-configurable pair
// (`get_idle_timeout`/`set_idle_timeout`), so the DJ can tune or disable the
// idle handover to the Live-set attractor ("Wicked Casting" - see
// docs/ABLETON_INTEGRATION.md) without a redeploy. Same three-minute default
// as before; TIMEOUT_WARNING_IN_MILLISECONDS is unchanged and un-configurable
// (only the overall timeout is exposed).
let idleTimeoutMs = 60 * 3 * 1000; // three minutes
let idleTimeoutEnabled = true;
// WOW-007C item 4: while DJ mode is active on the frontend, the idle timeout
// must never hand over to the Live-set attractor ("pause music") — a DJ
// mid-set is supervised operation, not visitor idleness. Deliberately NOT
// persisted (module-level `let`, reset to false on every backend restart) -
// same failsafe posture as idleTimeoutEnabled/idleTimeoutMs above: if the
// backend restarts mid-DJ-set, it comes back up in the safe default (timeout
// armed), not silently stuck suppressed forever. The frontend re-asserts DJ
// mode on every reconnect for exactly this reason (see PlayModeContainer).
let djModeActive = false;
const TIMEOUT_WARNING_IN_MILLISECONDS = 30 * 1000; // thirty seconds
// One minute, deliberately ABOVE TIMEOUT_WARNING_IN_MILLISECONDS: at a
// timeout equal to the warning offset the warning timer would arm with a
// zero/negative delay and fire immediately after every activity reset
// (audio-ableton review, PR #56). startTimeoutTimer also guards the arm.
const MIN_IDLE_TIMEOUT_MS = 60 * 1000;
const MAX_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // one hour

// WOW-007C: the drum-rack "cauldron sample" track, after the four pillar
// tracks (0-3). `Number(undefined)` is NaN, so an unset env var fails the
// integer/non-negative check below exactly like a garbage value - both
// disable the feature cleanly rather than crashing startup.
const DRUM_RACK_TRACK_INDEX = Number(process.env.DRUM_RACK_TRACK_INDEX);
const isDrumRackTrackIndexValid =
  Number.isInteger(DRUM_RACK_TRACK_INDEX) && DRUM_RACK_TRACK_INDEX >= 0;
if (!isDrumRackTrackIndexValid) {
  Logger.warn(
    `DRUM_RACK_TRACK_INDEX env var is missing or invalid ("${process.env.DRUM_RACK_TRACK_INDEX}") - cauldron sample/volume features disabled. Set it in .env to the drum-rack track's 0-based index.`,
  );
}

// Same ceiling the frontend already enforces for pillar volume sliders
// (VOLUME_MAX in src/container/PillarCardContainer.tsx / PillarViewUtil.ts) -
// applied here too so an out-of-range value from any caller (UI bug, stale
// client, malformed socket payload) can't push a track louder than the
// installation's own volume ceiling (AGENTS.md "Volume" safety rule).
const PILLAR_VOLUME_CEILING = 0.7;
// The original hardcoded clip-start default, now also the cauldron-volume
// fallback — one named source so the backend's uses can't drift (general
// review, PR #56). The frontend and sim keep mirrored copies per the
// established contract-mirroring pattern.
const DEFAULT_TRACK_VOLUME = 0.6;
function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(PILLAR_VOLUME_CEILING, Math.max(0, volume));
}

// WOW-032: bounded startup connection timeout + remote-script version diagnostics.
const ABLETON_START_TIMEOUT_MS = Number(process.env.ABLETON_START_TIMEOUT_MS) || 45000;
const DEFAULT_REMOTE_SCRIPT_VERSION_PATH = path.join(
  os.homedir(),
  'Music/Ableton/User Library/Remote Scripts/AbletonJS/version.py',
);
// Where ableton-js discovers the remote script's UDP port. The remote script writes
// this file once at Live startup; macOS periodically purges the temp dir, so a Live
// instance left running for days can lose it while the script itself stays alive.
const ABLETON_SERVER_PORT_FILE = path.join(os.tmpdir(), 'ableton-js-server.port');
// Same script yarn fix-ableton-port runs; the backend's cwd is backend/.
const RESTORE_PORT_FILE_SCRIPT = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'restore-ableton-port-file.sh',
);

let timeoutId: NodeJS.Timeout;
let timeoutWarningId: NodeJS.Timeout;
let allAbletonClips: ClipBoard;
// Reassigned in place (tracks.length = 0; tracks.push(...)) rather than
// wholesale (`tracks = ...`) so the AbletonAdapter.tracks getter's returned
// reference stays live for external mutation - the same "getter returns the
// mutable array" seam trackVolumes already uses, which lets tests inject fake
// Track objects without a live Ableton connection (see
// backend/adapter/test/AbletonAdapter.test.ts).
const tracks: Track[] = [];
// Same "getter returns the mutable array" seam as `tracks` above - see there
// for why (backend/adapter/test/AbletonAdapter.test.ts pushes fake
// DeviceParameters into this directly).
const trackVolumes: Array<DeviceParameter> = [];
let phraseLeader: Maybe<ClipInfo>;
let cleanUpPhraseLeaderEventListener: (() => Promise<unknown>) | undefined;

let keyLockEnabled = true;
let masterKey = '';
const stoppingClips: ClipList = [];
const playingClips: ClipList = [];
const queuedClips: ClipList = [];

// WOW-007C ("trigger random drum rack sample", ported from upstream
// j-pollack/witches-of-wubb commit 633d67a with fixes - see PR description):
// cache of the drum-rack track's non-null clips, refetched lazily by
// triggerRandomDrumSample when empty/stale. null = never fetched;
// [] = fetched but empty (or the feature is disabled).
let drumRackClips: Clip[] | null = null;
// Lazily-fetched, cached DeviceParameter for the drum-rack track's volume -
// mirrors trackVolumes' shape but for the single non-pillar cauldron track.
let cauldronVolumeParam: DeviceParameter | undefined;

// WOW-007C (human request): the last volume a caller explicitly asked for on
// each pillar, so a new clip starting on that pillar restores it instead of
// always slamming the pre-existing hardcoded 0.6 (see resolveClipStartVolume
// and the playing_slot_index listener below). null = never explicitly set.
const desiredVolumes: (number | null)[] = [null, null, null, null];

const ableton = new Ableton({ logger: Logger });

const TRIGGER_ORDER = [ClipTypes.Drums, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Vox];

// Pure: reads a `version = "X.Y.Z"` line from an AbletonJS midi-script version.py-style
// file. Returns undefined (never throws) if the file is missing or unparseable - a missing
// remote script is an expected, non-fatal state (e.g. before first install). Captures
// anything between the quotes (not just digits/dots) so pre-release/build-suffixed
// versions like ableton-js's own historical "2.2.1-0" still parse instead of silently
// falling through to "can't read version, skip check".
function parseRemoteScriptVersion(filePath: string): Maybe<string> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.match(/version\s*=\s*["']([^"']+)["']/)?.[1];
  } catch {
    return undefined;
  }
}

function getShippedRemoteScriptVersionPath(): string {
  const packageJsonPath = require.resolve('ableton-js/package.json');
  return path.join(path.dirname(packageJsonPath), 'midi-script', 'version.py');
}

// Pre-flight, file-only, before attempting a connection: compares the remote-script
// version this npm package ships against whatever's actually installed in Live's Remote
// Scripts folder. Never fatal - a missing installed script just means "not installed yet".
function checkRemoteScriptVersionPreflight() {
  const shippedVersion = parseRemoteScriptVersion(getShippedRemoteScriptVersionPath());
  const installedPath =
    process.env.ABLETON_REMOTE_SCRIPT_VERSION_PATH || DEFAULT_REMOTE_SCRIPT_VERSION_PATH;
  const installedVersion = parseRemoteScriptVersion(installedPath);

  if (!installedVersion) {
    Logger.info(
      `No installed AbletonJS remote-script version found at "${installedPath}" - skipping pre-flight version check (expected if it isn't installed there, or installed elsewhere; override with ABLETON_REMOTE_SCRIPT_VERSION_PATH).`,
    );
  } else if (!shippedVersion) {
    Logger.info(
      'Could not read the npm-shipped AbletonJS remote-script version - skipping pre-flight version check.',
    );
  } else if (shippedVersion !== installedVersion) {
    Logger.warn(
      `AbletonJS remote-script version mismatch: npm package ships ${shippedVersion}, installed script at "${installedPath}" reports ${installedVersion}. If the connection hangs or times out, copy backend/node_modules/ableton-js/midi-script/ into Live's Remote Scripts folder as "AbletonJS" and restart Live.`,
    );
  } else {
    Logger.info(`AbletonJS remote-script version OK (${shippedVersion}).`);
  }
}

// Post-connect: the library's own isPluginUpToDate() only warns when the plugin is
// *older* than this npm package, and never runs at all when the handshake itself is
// incompatible (the observed failure). Log both versions unconditionally instead.
async function logConnectedRemoteScriptVersion() {
  const shippedVersion = parseRemoteScriptVersion(getShippedRemoteScriptVersionPath());
  try {
    const liveVersion = await ableton.internal.get('version');
    if (shippedVersion && liveVersion !== shippedVersion) {
      Logger.warn(
        `Connected, but AbletonJS versions differ: npm package ${shippedVersion}, running remote script ${liveVersion}.`,
      );
    } else {
      Logger.info(
        `Connected to AbletonJS remote script version ${liveVersion} (npm package ${
          shippedVersion ?? 'unknown'
        }).`,
      );
    }
  } catch (err) {
    Logger.warn(err, 'Could not read the connected remote-script version (non-fatal)');
  }
}

// Best-effort, never throws: if the server port file is missing (macOS purges the temp
// dir under long-running Live instances), try to restore it by running the same script
// yarn fix-ableton-port runs. Failure is fine - ableton.start's timeout error covers it.
// portFilePath/exec are injectable for tests only; production callers pass nothing.
function ensureServerPortFile(
  portFilePath: string = ABLETON_SERVER_PORT_FILE,
  exec: (file: string, options: { timeout: number; encoding: 'utf-8' }) => string = execFileSync,
) {
  if (fs.existsSync(portFilePath)) return;
  Logger.warn(
    `AbletonJS server port file is missing ("${portFilePath}") - ` +
      'attempting automatic restore (equivalent to running "yarn fix-ableton-port").',
  );
  try {
    const output = exec(RESTORE_PORT_FILE_SCRIPT, {
      timeout: 10_000,
      encoding: 'utf-8',
    });
    Logger.info(`Port file restore: ${output.trim()}`);
  } catch (err) {
    // Prefer the script's stderr; fall back to the exec error itself (ENOENT,
    // EACCES, timeout kills), which produces no stderr.
    const e = err as { stderr?: string; message?: string };
    const reason = e.stderr?.trim() || e.message || String(err);
    Logger.warn(
      `Automatic port file restore failed: ${reason} - the connection ` +
        `will hang until the file appears (up to ${ABLETON_START_TIMEOUT_MS}ms). ` +
        'If Live is NOT running, just start it (Live rewrites the file on startup). ' +
        'Otherwise see README "Troubleshooting: backend hangs or exits at startup".',
    );
  }
}

async function startAbleton() {
  Logger.info('Starting AbletonJS');
  checkRemoteScriptVersionPreflight();
  ensureServerPortFile();
  try {
    await ableton.start(ABLETON_START_TIMEOUT_MS);
  } catch (err) {
    throw new Error(
      `Failed to connect to Ableton within ${ABLETON_START_TIMEOUT_MS}ms. Common causes: ` +
        "(1) Live isn't running; (2) the AbletonJS control surface isn't enabled in Live " +
        "Preferences → Link/Tempo/MIDI; (3) the installed remote-script version doesn't " +
        'match this npm package (see the pre-flight version check above). Remediation for (3): ' +
        "copy backend/node_modules/ableton-js/midi-script/ into Live's Remote Scripts folder " +
        'as "AbletonJS" and restart Live. (4) macOS purged the ableton-js server port file ' +
        'while Live kept running - the backend attempts an automatic restore at startup ' +
        '(logged above if it ran); if that failed, see its warning or run ' +
        '"yarn fix-ableton-port" manually.',
      { cause: err instanceof Error ? err : new Error(String(err)) },
    );
  }
  await logConnectedRemoteScriptVersion();
  await getTracksAndClips();
  await getTrackVolumes();
  // WOW-007C: loaded after getTracksAndClips so `tracks` is already
  // populated; never fatal to startup (own try/catch, warns and disables
  // cleanly) - a missing/misconfigured drum-rack track shouldn't block the
  // rest of the installation from starting.
  await getDrumRackClips().catch((err) =>
    Logger.error(err, 'Error fetching drum-rack clips at startup'),
  );
}

async function handleTimeout() {
  for (let i = 0; i < 4; i++) {
    await tracks[i].sendCommand('stop_all_clips');
  }
  masterKey = '';
  OutgoingEvents.emitEventWithoutResettingTimeout('master-key_changed', { key: masterKey });

  queuedClips.forEach((queuedClip, pillar) => {
    if (!queuedClip) return;
    // Mirrors stopOrRemoveClipFromQueue's queued-removal branch: pitch_coarse
    // is a persistent Ableton clip-slot parameter, so a clip key-lock had
    // transposed while queued must be reset before it's dropped, or it stays
    // wrongly transposed for its next unrelated use.
    if (keyLockEnabled) {
      const queuedClipsInLoop = FindAllClipsInLoop(queuedClip.clipName, pillar);
      queuedClipsInLoop.forEach(
        (clip) => clip !== null && transposeClipToNewKey({ ...queuedClip, clip }, ''),
      );
    }
    queuedClips[pillar] = null;
    OutgoingEvents.emitEventWithoutResettingTimeout('clip_unqueued', {
      ...queuedClip,
      clip: undefined,
    });
  });
}

// Crash-exit only: unlike handleTimeout, this must never throw or hang past
// its caller's own bound, so every track's command is caught individually
// and dispatched in parallel rather than awaited one at a time.
async function stopAllClipsBestEffort() {
  if (!tracks?.length) {
    Logger.warn('Skipping crash-exit stop_all_clips: Ableton tracks not yet loaded');
    return;
  }
  try {
    await Promise.all(
      tracks
        .slice(0, 4)
        .map((track, pillar) =>
          track
            .sendCommand('stop_all_clips')
            .catch((err) =>
              Logger.error(err, `Error stopping clips on pillar ${pillar + 1} during crash exit`),
            ),
        ),
    );
  } catch (err) {
    Logger.error(err, 'Error attempting best-effort stop_all_clips during crash exit');
  }
}

function startTimeoutTimer() {
  // WOW-007C: disabling the idle timeout (`set_idle_timeout`) means spells
  // loop indefinitely and the Live-set attractor never engages - arm nothing.
  if (!idleTimeoutEnabled) {
    Logger.info('Idle timeout disabled - not arming timers');
    return;
  }
  // WOW-007C item 4: DJ mode active - arm nothing (same shape as the
  // idleTimeoutEnabled guard above). The idle handover must never fire while
  // a DJ is supervising the installation; restartTimeoutTimer (called by
  // setDjModeActive on every transition) always clears any already-armed
  // timers first, so entering DJ mode also cancels a timer that was already
  // ticking down.
  if (djModeActive) {
    Logger.info('DJ mode active - not arming idle timeout timers');
    return;
  }
  Logger.info('Starting timeout timer');
  function shouldShowTimeout() {
    return (
      playingClips.filter((clip) => clip).length > 0 &&
      stoppingClips.filter((clip) => clip).length === 0
    );
  }
  // Belt-and-braces with MIN_IDLE_TIMEOUT_MS: never arm the warning with a
  // zero/negative delay (it would fire instantly on every activity reset).
  const warningDelay = idleTimeoutMs - TIMEOUT_WARNING_IN_MILLISECONDS;
  if (warningDelay > 0) {
    timeoutWarningId = setTimeout(() => {
      if (shouldShowTimeout()) {
        Logger.warn('Timeout warning');
        OutgoingEvents.emitEventWithoutResettingTimeout('timeout_warning');
      }
    }, warningDelay);
  }
  timeoutId = setTimeout(() => {
    if (shouldShowTimeout()) {
      Logger.warn('Timeout exceeded, restarting the UI');
      handleTimeout().catch((err) => Logger.error(err, 'Error handling idle timeout'));
    }
  }, idleTimeoutMs);
}

function restartTimeoutTimer() {
  Logger.warn('Restarting timeout timer');
  // Always clear first, even when now-disabled: startTimeoutTimer's early
  // return above only skips arming *new* timers, it doesn't clear stale ones.
  clearTimeout(timeoutId);
  clearTimeout(timeoutWarningId);
  startTimeoutTimer();
}

function getIdleTimeoutConfig(): IdleTimeoutConfigType {
  return { enabled: idleTimeoutEnabled, timeoutMs: idleTimeoutMs };
}

// Validates and applies a new idle-timeout config, then re-arms (or clears)
// the running timers immediately so a change takes effect without waiting
// for the next activity event. Invalid timeoutMs is ignored (warn + no
// change) rather than falling back to a guessed default - same "no
// surprises" posture as setTempo's NaN guard (WOW-020).
function setIdleTimeoutConfig(config: IdleTimeoutConfigType): IdleTimeoutConfigType {
  const { enabled, timeoutMs } = config;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_IDLE_TIMEOUT_MS ||
    timeoutMs > MAX_IDLE_TIMEOUT_MS
  ) {
    Logger.warn(
      `Ignoring setIdleTimeoutConfig: timeoutMs ${timeoutMs} must be an integer in [${MIN_IDLE_TIMEOUT_MS}, ${MAX_IDLE_TIMEOUT_MS}]`,
    );
    return getIdleTimeoutConfig();
  }
  idleTimeoutEnabled = Boolean(enabled);
  idleTimeoutMs = timeoutMs;
  Logger.info(`Idle timeout config: enabled=${idleTimeoutEnabled} timeoutMs=${idleTimeoutMs}`);
  restartTimeoutTimer();
  OutgoingEvents.emitEventWithoutResettingTimeout('idle_timeout_changed', getIdleTimeoutConfig());
  return getIdleTimeoutConfig();
}

function getDjModeActive(): boolean {
  return djModeActive;
}

// WOW-007C item 4: validates and applies a DJ-mode transition, then re-arms
// (or clears) the idle-timeout timers immediately via restartTimeoutTimer -
// same "validate, assign, log, broadcast, re-arm" shape as
// setIdleTimeoutConfig above, except djModeActive has no bounds to check,
// only a type: a non-boolean payload (malformed client, stale contract) is
// ignored (warn + no change) rather than coerced, same "no surprises"
// posture as setTempo's NaN guard (WOW-020) and setIdleTimeoutConfig's
// out-of-bounds guard. No ack (frozen per the ticket - the frontend doesn't
// need to read this back, only broadcast listeners like the lighting/other
// UI instances do via `dj_mode_changed`).
function setDjModeActive(active: boolean): boolean {
  if (typeof active !== 'boolean') {
    Logger.warn(`Ignoring setDjModeActive(${JSON.stringify(active)}): not a boolean`);
    return djModeActive;
  }
  djModeActive = active;
  Logger.info(`DJ mode: ${djModeActive}`);
  OutgoingEvents.emitEventWithoutResettingTimeout('dj_mode_changed', { active: djModeActive });
  // Re-arms (DJ mode ending, by any path - explicit exit or the frontend's
  // own walk-away auto-exit) or clears (DJ mode starting) the timers
  // immediately, without waiting for the next visitor-activity emission -
  // same immediate-effect posture as setIdleTimeoutConfig.
  restartTimeoutTimer();
  return djModeActive;
}

// Failsafe symmetric to the non-persistence posture above (audio-ableton
// delta review of the DJ-gate commit, finding 1): the suppression's entire
// recovery chain — walk-away auto-exit, explicit Settings toggle — lives in
// the FRONTEND, so if the last supervising UI dies while DJ mode is active
// (browser crash, kiosk power loss), nothing would ever emit
// `set_dj_mode {active:false}` and the attractor handover would stay
// suppressed indefinitely. index.ts calls this when the last web client
// disconnects: no supervising UI connected = timeout armed. A transient
// drop/reconnect is harmless — the frontend re-asserts its mode on every
// (re)connect (PlayModeContainer), restoring suppression within a second if
// a DJ session is genuinely still running.
function handleLastWebClientDisconnected(): void {
  if (!djModeActive) return;
  Logger.info(
    'Last web client disconnected while DJ mode active — lifting idle-timeout suppression',
  );
  setDjModeActive(false);
}

function connectOscServer(server: nodeOSC.Server) {
  oscServer = server;
  oscServer.on('message', IncomingEvents.oscEventHandlers);
}

// Live-set lookups use the same [* ]-strip normalization as every other
// comparison site (WOW-031): clip names in the Live set may freely contain
// spaces and asterisks (human decision 2026-07-12), so the previous
// trim-only matching would silently fail to locate those clips.
const MemoizedClipIndex = memoize(
  (clipName, pillar) => {
    const normalizedClipName = ClipNameUtil.normalizeClipName(clipName);
    return allAbletonClips[pillar].findIndex((clip) => {
      return clip !== null && ClipNameUtil.normalizeClipName(clip.raw.name) === normalizedClipName;
    });
  },
  (clipName, pillar) => `${ClipNameUtil.normalizeClipName(clipName)}-${pillar}`,
);

function addWebSocket(s: socketio.Socket) {
  s.on('disconnect', () => {
    Logger.info('Web client disconnected');
    const disconnectedSocketIndex = sockets.findIndex((socket) => socket === s);
    sockets.splice(disconnectedSocketIndex, 1);
  });
  sockets.push(s);
  IncomingEvents.addSocketEventsHandlers(s);
}

const FindAllClipsInLoop = memoize(
  (clipName, pillar) => {
    Logger.info(`Trying to find all clips in loop on pillar ${pillar + 1} > ${clipName}`);
    const firstClipIndex = MemoizedClipIndex(clipName, pillar);
    if (firstClipIndex < 0) return [];

    const normalizedClipName = ClipNameUtil.normalizeClipName(clipName);
    const lastClipIndex = allAbletonClips[pillar]
      .slice(firstClipIndex, firstClipIndex + 20)
      .findLastIndex((clip) => {
        return (
          clip !== null && ClipNameUtil.normalizeClipName(clip.raw.name) === normalizedClipName
        );
      });
    Logger.debug(
      `Loop for ${clipName} found on ${pillar + 1} > [${firstClipIndex}, ${
        firstClipIndex + lastClipIndex + 1
      }]`,
    );
    return allAbletonClips[pillar].slice(firstClipIndex, firstClipIndex + lastClipIndex + 1);
  },
  (clipName, pillar) => `${ClipNameUtil.normalizeClipName(clipName)}-${pillar}`,
);

function queueClip(clipMetadata: ClipMetadataType, pillar: number) {
  const { clipName, key } = clipMetadata;
  Logger.info(`Begin queuing clip ${clipName}`);
  const alreadyQueuedClipName = queuedClips[pillar]?.clipName;
  if (
    alreadyQueuedClipName !== undefined &&
    ClipNameUtil.normalizeClipName(alreadyQueuedClipName) ===
      ClipNameUtil.normalizeClipName(clipName)
  ) {
    Logger.info(`Clip ${clipName} is already queued`);
    return;
  }
  const clips = FindAllClipsInLoop(clipName, pillar);
  if (clips.length) {
    // if no items are playing, skip the queue
    const silence = playingClips.every((clip) => !clip);

    if (playingClips.every((item) => !item) || masterKey === '') {
      // we're coming from a silent state, or an undefined key state, so let's try to set master key
      clipMetadata.key && setMasterKey(key ?? '');
    }

    // TODO: transpose all clips in a block (even when toggling the key lock)
    keyLockEnabled &&
      clips.forEach(
        (clip) => clip && transposeClipToNewKey({ ...clipMetadata, clip, pillar }, masterKey),
      );
    if (silence) {
      Logger.info(`Triggering clip "${clipName}" on pillar ${pillar + 1}`);
      clips[0]
        ?.fire()
        .catch((err) =>
          Logger.error(err, `Error firing clip "${clipName}" on pillar ${pillar + 1}`),
        );
    } else if (clips[0]) {
      Logger.info(`Queuing clip "${clipName}" on pillar ${pillar + 1}`);
      queuedClips[pillar] = {
        clip: clips[0],
        pillar,
        ...clipMetadata,
      };
      OutgoingEvents.emitEvent('clip_queued', {
        pillar,
        ...clipMetadata,
      });
    }
  } else {
    Logger.warn(`No clip "${clipName}" found on pillar ${pillar + 1}`);
    OutgoingEvents.emitEvent('clip_unqueued', {
      ...clipMetadata,
      pillar,
    });
  }
}

async function triggerQueuedClips() {
  Logger.info(`Begin triggering clip queue`);
  for (let i = 0; i < queuedClips.length; i++) {
    const item = queuedClips[i];
    if (!item) continue;
    Logger.info(`Triggering clip "${item.clip.raw.name}" on pillar ${item.pillar} `);
    await item.clip.fire();
    queuedClips[item.pillar] = null;
  }
}

async function stopOrRemoveClipFromQueue(clipName: string, pillar: number) {
  Logger.trace(`Try to stop or unqueue clip ${clipName}`);
  const playingClip = playingClips[pillar];
  const queuedClip = queuedClips[pillar];

  const isClipPlaying =
    playingClip?.clipName !== undefined &&
    ClipNameUtil.normalizeClipName(playingClip.clipName) ===
      ClipNameUtil.normalizeClipName(clipName);
  if (isClipPlaying) {
    Logger.info(`Stopping clip "${clipName}" on pillar ${pillar + 1}`);
    stoppingClips[pillar] = playingClip;
    // clip.stop() won't work because of looping: stop the whole track instead.
    OutgoingEvents.emitEvent('clip_stopping', {
      ...playingClip,
      clip: undefined,
    });
    await tracks[pillar].sendCommand('stop_all_clips');

    playingClips[pillar] = null;
    if (!phraseLeader) {
      Logger.info(`No phrase leader set yet; skipping promotion check for pillar ${pillar + 1}`);
    } else if (
      ClipNameUtil.normalizeClipName(playingClip.clipName) ===
      ClipNameUtil.normalizeClipName(phraseLeader.clipName)
    ) {
      // Find the next phrase leader, check if such a clip is playing,
      // then promote that clip to phrase leader else trigger queued clips and let god sort it out.
      const promotedClip = PhraseLeaderService.findNextPhraseLeader(playingClips);
      if (promotedClip) {
        addPhraseLeader(promotedClip).catch((err) =>
          Logger.error(err, `Error adding phrase leader on pillar ${pillar + 1}`),
        );
      } else {
        triggerQueuedClips().catch((err) => Logger.error(err, 'Error triggering queued clips'));
      }
    }
  }

  // check if the clip is queued
  const isClipQueued =
    queuedClip?.clipName !== undefined &&
    ClipNameUtil.normalizeClipName(queuedClip.clipName) ===
      ClipNameUtil.normalizeClipName(clipName);
  if (isClipQueued) {
    Logger.info(`Removing clip from queue "${clipName}" on pillar ${pillar + 1}`);
    if (keyLockEnabled) {
      const queuedClipsInLoop = FindAllClipsInLoop(clipName, pillar);

      queuedClipsInLoop.forEach(
        (clip) => clip !== null && transposeClipToNewKey({ ...queuedClip, clip }, ''),
      );
    }
    queuedClips[pillar] = null;
    OutgoingEvents.emitEvent('clip_unqueued', {
      ...queuedClip,
      clip: undefined,
    });
  }

  if (!isClipPlaying && !isClipQueued) {
    Logger.warn(
      `Clip ${clipName} is neither playing or queue. Stopping pillar ${pillar + 1} just in case.`,
    );
    await tracks[pillar].sendCommand('stop_all_clips');
    OutgoingEvents.emitEventWithoutResettingTimeout('clip_stopped', { pillar });
  }
}

async function addPhraseLeader(newPhraseLeader: ClipInfo) {
  if (cleanUpPhraseLeaderEventListener) {
    cleanUpPhraseLeaderEventListener().catch((err) =>
      Logger.error(err, 'Error cleaning up previous phrase leader listener'),
    );
  }
  phraseLeader = newPhraseLeader;

  const { clip, clipName, pillar } = newPhraseLeader;
  Logger.info(`New phrase leader "${clipName}" on pillar ${pillar + 1}`);

  // figure out when this clip is about to end
  const endTime = await clip.get('loop_end');
  Logger.debug(`Loop end on pillar ${pillar + 1} > "${clipName}" | ${endTime}`);
  cleanUpPhraseLeaderEventListener = await clip.addListener(
    'playing_position',
    throttle(
      function (clip: ClipInfo, endTime: number, currentTime: number) {
        if (currentTime >= endTime - 1) {
          Logger.info(
            `Clip ending soon on pillar ${clip.pillar} > "${clip.clipName}" | ${currentTime} / ${endTime}`,
          );
          if (cleanUpPhraseLeaderEventListener) {
            cleanUpPhraseLeaderEventListener().catch((err) =>
              Logger.error(err, 'Error cleaning up phrase leader listener'),
            );
          }
          triggerQueuedClips().catch((err) => Logger.error(err, 'Error triggering queued clips'));
        }
      }.bind({}, newPhraseLeader, endTime),
      300,
    ),
  );
}

const getTracksAndClips = async () => {
  Logger.info('Fetching tracks and clips from Ableton');
  // MemoizedClipIndex/FindAllClipsInLoop cache Clip object references keyed
  // by clipName-pillar with no expiry - stale entries from a previous fetch
  // would otherwise keep resolving to Clip handles from the old
  // allAbletonClips array after a re-scan (WOW-021). Clear before
  // reassigning allAbletonClips below so every fetch starts from empty caches.
  MemoizedClipIndex.cache.clear?.();
  FindAllClipsInLoop.cache.clear?.();
  // 2-D array of all the clips, ordered by Track
  allAbletonClips = [];
  const fetchedTracks = await ableton.song.get('tracks');
  // Mutate in place (not `tracks = fetchedTracks`) so the AbletonAdapter.tracks
  // getter's returned reference stays live - see the `const tracks` declaration
  // above (never reassigned, only mutated - that's why it's `const`).
  tracks.length = 0;
  tracks.push(...fetchedTracks);
  // The freshly-fetched tracks invalidate anything cached off the OLD track
  // objects: the cauldron volume DeviceParameter and the drum-rack clip
  // cache both refetch lazily on next use (audio-ableton + general reviews,
  // PR #56 — previously a getTracksAndClips re-run left them stale forever).
  cauldronVolumeParam = undefined;
  drumRackClips = null;

  for (let pillar = 0; pillar < 4; pillar++) {
    const track = tracks[pillar];
    const clipSlots = await track.get('clip_slots');

    track
      .addListener('playing_slot_index', async (clipSlotIndex: number) => {
        try {
          Logger.info('Playing slot index changed: ' + clipSlotIndex);
          if (clipSlotIndex >= 0) {
            const clip = allAbletonClips[pillar][clipSlotIndex];
            const clipName = clip?.raw.name;
            if (clipName) {
              const clipMetadata =
                MusicDatabaseService.clipNameToInfoMap[ClipNameUtil.normalizeClipName(clipName)];
              const clipInfo = {
                ...clipMetadata,
                clipName,
                pillar,
              };

              Logger.info(`Pillar ${pillar + 1} started playing ${clipName}`);
              if (!clipMetadata) {
                Logger.error(`Couldn't find clip metadata for "${clipName}"`);
                return;
              }

              if (playingClips[pillar]?.clipName && clipName !== playingClips[pillar]?.clipName) {
                // In the case where a whole new song gets queued and triggered without the previous
                // song being stopped, we need to make sure that we transpose the previous song back to 0
                const previousClipsInLoop = FindAllClipsInLoop(
                  playingClips[pillar]?.clipName,
                  pillar,
                );
                previousClipsInLoop.forEach(
                  (clip) =>
                    clip &&
                    transposeClipToNewKey({ ...(playingClips[pillar] as ClipInfo), clip }, ''),
                );
              }

              const warpMarkers = await clip.get('warp_markers');
              const bpm = calculateBpmFromWarpMarkers(warpMarkers);
              if (bpm === undefined) {
                Logger.warn(
                  `Could not calculate BPM for clip "${clipName}" on pillar ${
                    pillar + 1
                  }: degenerate warp markers`,
                );
              }
              const browserInfo = { ...clipInfo, bpm };
              if (playingClips[pillar]?.clipName === clipName) {
                OutgoingEvents.emitEventWithoutResettingTimeout('clip_playing', browserInfo);
              } else {
                OutgoingEvents.emitEvent('clip_started', browserInfo);
                setTrackVolume(pillar, resolveClipStartVolume(pillar)).catch((err) =>
                  Logger.error(err, `Error setting track volume on pillar ${pillar + 1}`),
                );
              }
              if (playingClips.every((item) => !item)) {
                // we're coming from a silent state, so let's set the tempo to this new
                // clip's bpm - unless the warp markers were degenerate, in which case skip
                // adoption and keep whatever tempo is already set (WOW-020: no fallback,
                // no guess - the ticket's own "no-surprise behavior" instruction).
                if (bpm !== undefined) {
                  setTempo(bpm);
                }
                clipMetadata.key && setMasterKey(clipMetadata.key);
              }

              playingClips[pillar] = { ...clipInfo, clip };
              // A clip STARTING on this pillar means nothing is stopping on
              // it anymore — clear any stale stoppingClips entry. Without
              // this, an old->new slot transition that skips the interim -1
              // (same-boundary replace, now the routine Apply gesture) left
              // the entry set forever, and shouldShowTimeout then returned
              // false permanently — silently disabling the idle handover to
              // the attractor (audio-ableton delta review, PR #56, finding 4).
              stoppingClips[pillar] = null;

              const newPhraseLeader = PhraseLeaderService.findNextPhraseLeader(playingClips);
              if (newPhraseLeader?.clipName === clipName) {
                addPhraseLeader(newPhraseLeader).catch((err) =>
                  Logger.error(err, `Error adding phrase leader on pillar ${pillar + 1}`),
                );
              }
            }
          } else {
            const clipInfo = stoppingClips[pillar];
            Logger.info(`Clip stopped playing on pillar ${pillar + 1} > "${clipInfo?.clipName}"`);
            OutgoingEvents.emitEventWithoutResettingTimeout('clip_stopped', {
              ...clipInfo,
              pillar,
              clip: undefined,
            });

            if (clipInfo?.clipName && keyLockEnabled) {
              const playingClipsInLoop = FindAllClipsInLoop(clipInfo?.clipName, pillar);
              playingClipsInLoop.forEach(
                (clip) => clip && transposeClipToNewKey({ ...clipInfo, clip }, ''),
              );
            }

            stoppingClips[pillar] = null;
            playingClips[pillar] = null;
          }
        } catch (err) {
          Logger.error(err, `Error handling playing_slot_index change on pillar ${pillar + 1}`);
        }
      })
      .catch((err) =>
        Logger.error(err, `Error registering playing_slot_index listener on pillar ${pillar + 1}`),
      );

    allAbletonClips.push([]);

    for (let clipSlotIndex = 0; clipSlotIndex < clipSlots.length; clipSlotIndex++) {
      const cs = clipSlots[clipSlotIndex];
      const clip = await cs.get('clip');
      allAbletonClips[pillar].push(clip);
    }

    await rebuildPillarPlayingState(pillar, track, allAbletonClips[pillar]);
  }

  // Audio-ableton delta review (PR #56, finding 1): a rebuild that restores
  // playingClips but leaves phraseLeader unset DEADLOCKS the queue — both
  // queued-clip firing paths need a leader (the leader's playing_position
  // listener, and stopOrRemoveClipFromQueue's promotion branch, which is
  // skipped when !phraseLeader), so the first placement after a
  // restart-over-music would queue forever. addPhraseLeader is state-only in
  // the relevant sense (a loop_end read + listener registration; no
  // emissions, no volume/tempo/key writes) — exactly the state the
  // playing_slot_index listener would have built had it been alive, selected
  // by the same TRIGGER_ORDER rule.
  if (!phraseLeader) {
    const rebuiltLeader = PhraseLeaderService.findNextPhraseLeader(playingClips);
    if (rebuiltLeader) {
      await addPhraseLeader(rebuiltLeader).catch((err) =>
        Logger.error(err, 'Error re-establishing phrase leader after playing-state rebuild'),
      );
    }
  }
  Logger.info('Tracks and clips from Ableton fetched');

  return { allAbletonClips, tracks };
};

/**
 * WOW-007C (human bug report 2026-07-20): rebuilds one pillar's playing
 * state from Ableton's CURRENT playing_slot_index at getTracksAndClips time.
 * The playing_slot_index listener only sees FUTURE slot changes, so a
 * backend restart while Ableton kept looping (nodemon restarts on file
 * changes and crashes) left playingClips empty until the next transition —
 * a UI (re)load then showed empty pillars over audible music.
 *
 * State-only reconstruction, deliberately: no event emissions, no volume
 * writes, no tempo/key adoption, no phrase-leader changes — those are
 * live-transition concerns owned by the listener; get_playing_clips fetches
 * simply serve the rebuilt state. Never clobbers state a listener already
 * built (re-run safety), and never throws (startup must not be blocked).
 * Exported as a seam (same pattern as calculateBpmFromWarpMarkers) so the
 * behaviour is testable without the full getTracksAndClips machinery.
 */
async function rebuildPillarPlayingState(
  pillar: number,
  track: Track,
  pillarClips: (Clip | null)[],
): Promise<void> {
  try {
    const currentSlotIndex = await track.get('playing_slot_index');
    if (typeof currentSlotIndex !== 'number' || currentSlotIndex < 0) return;
    if (playingClips[pillar]) return;

    const clip = pillarClips[currentSlotIndex];
    const clipName = clip?.raw.name;
    if (!clipName) return;

    const clipMetadata =
      MusicDatabaseService.clipNameToInfoMap[ClipNameUtil.normalizeClipName(clipName)];
    if (!clipMetadata) {
      Logger.warn(`Pillar ${pillar + 1} is playing unknown clip "${clipName}" - state not rebuilt`);
      return;
    }

    playingClips[pillar] = { ...clipMetadata, clipName, pillar, clip };
    Logger.info(
      `Rebuilt playing state for pillar ${pillar + 1}: "${clipName}" was already playing`,
    );
  } catch (err) {
    Logger.error(err, `Error rebuilding playing state on pillar ${pillar + 1}`);
  }
}

async function getTempo() {
  Logger.info('Getting tempo');
  return ableton.song.get('tempo');
}

function setTempo(tempo: number) {
  // Belt-and-suspenders: this is a shared entry point for both the
  // warp-marker-driven path (already guarded at its own source, WOW-020)
  // and the UI tempo slider's set_tempo socket handler, whose input isn't
  // otherwise validated.
  if (!Number.isFinite(tempo)) {
    Logger.warn(`Ignoring setTempo(${tempo}): not a finite number`);
    return;
  }
  Logger.info(`Setting tempo to: ${tempo}`);
  ableton.song
    .set('tempo', tempo)
    .catch((err) => Logger.error(err, `Error setting tempo to ${tempo}`));
  OutgoingEvents.emitEvent('tempo_changed', { tempo });
}

async function getTrackVolumes() {
  Logger.info('Getting track volumes');
  // Mutate in place (not `trackVolumes = []`) so the AbletonAdapter.trackVolumes
  // getter's returned reference stays live - see the `const trackVolumes`
  // declaration above (never reassigned, only mutated - that's why it's `const`).
  trackVolumes.length = 0;
  for (const track of tracks.slice(0, 4)) {
    const mixerDevice = await track.get('mixer_device');
    const deviceParameter = await mixerDevice.sendCommand('get_volume');
    Logger.debug(
      `Getting volume device parameter for track ${track.raw.name}: ${JSON.stringify(
        deviceParameter,
      )}`,
    );
    trackVolumes.push(new DeviceParameter(ableton, deviceParameter));
  }
}

async function setTrackVolume(pillar: number, volume: number) {
  const clampedVolume = clampVolume(volume);
  Logger.info(`Setting volume for pillar ${pillar + 1} to ${clampedVolume}`);
  if (!trackVolumes?.length) await getTrackVolumes();
  const trackVolume = trackVolumes[pillar];
  await trackVolume?.set('value', clampedVolume);
  // WOW-007C (human request): remember what was explicitly asked for on this
  // pillar so the next clip that starts here restores it instead of the
  // hardcoded 0.6 - see resolveClipStartVolume.
  desiredVolumes[pillar] = clampedVolume;
  OutgoingEvents.emitEvent('volume_changed', { pillar, volume: clampedVolume });
}

// WOW-007C: small, pure/parameterized seam (same pattern as
// calculateBpmFromWarpMarkers) so the clip-start volume fallback is testable
// without exercising the whole playing_slot_index listener. 0.6 is the
// original hardcoded default, now only used until a pillar's volume has ever
// been explicitly set.
function resolveClipStartVolume(pillar: number): number {
  return desiredVolumes[pillar] ?? DEFAULT_TRACK_VOLUME;
}

// --- WOW-007C: cauldron drum-rack sample + volume -------------------------
// Ported from upstream j-pollack/witches-of-wubb commit 633d67a ("trigger
// random drum rack sample"), reimplemented in this repo's conventions and
// fixing the upstream issues found in review: an unhandled async rejection
// (every path here is try/catch-wrapped, WOW-014 style), a cache that was
// never invalidated on a stale/failed fire (refetched below), emitting
// before the clip actually fired (fire-then-emit ordering below), an
// unvalidated NaN env var (isDrumRackTrackIndexValid above), and no
// connection/track-presence guard (checked on every entry point here).

// Fetches and caches the drum-rack track's non-null clips. Called once at
// startup (after getTracksAndClips, so `tracks` is populated) and again,
// lazily, by triggerRandomDrumSample whenever the cache is empty or a fire
// fails (stale-clip recovery). Never throws: a missing/misconfigured track
// disables the feature cleanly (warn + empty cache) rather than blocking
// startup or crashing a tap.
async function getDrumRackClips(): Promise<Clip[]> {
  if (!isDrumRackTrackIndexValid) {
    drumRackClips = [];
    return drumRackClips;
  }
  const track = tracks[DRUM_RACK_TRACK_INDEX];
  if (!track) {
    Logger.warn(
      `Drum rack track index ${DRUM_RACK_TRACK_INDEX} not found among ${
        tracks?.length ?? 0
      } fetched tracks - cauldron sample feature disabled until getTracksAndClips is re-run`,
    );
    drumRackClips = [];
    return drumRackClips;
  }
  const clipSlots = await track.get('clip_slots');
  const clips: Clip[] = [];
  for (const clipSlot of clipSlots) {
    const clip = await clipSlot.get('clip');
    if (clip) clips.push(clip);
  }
  drumRackClips = clips;
  Logger.info(
    `Cauldron drum-rack clips loaded: ${clips.length} clip(s) on track "${track.raw.name}"`,
  );
  return drumRackClips;
}

// Fires a random one-shot from the drum-rack track and broadcasts
// `cauldron_sample_triggered`. Fire-then-emit (not the reverse, unlike the
// upstream bug this ports from): the browser/lighting side should only learn
// a sample triggered once it actually has, not optimistically before the
// Ableton call even resolves. Uses emitEvent (not the without-resetting
// variant) deliberately - a visitor tapping the cauldron is real activity and
// should defer the idle timeout exactly like any other interaction.
//
// Throttled (200ms, no trailing edge) so a flurry of taps can't flood
// Ableton with `fire()` calls; a suppressed tap during the window is simply
// dropped rather than queued, matching how a physical instrument would
// behave.
const triggerRandomDrumSample = throttle(
  async function triggerRandomDrumSampleImpl() {
    try {
      if (!drumRackClips || drumRackClips.length === 0) {
        await getDrumRackClips();
      }
      if (!drumRackClips || drumRackClips.length === 0) {
        Logger.warn('No cauldron/drum-rack clips available to trigger');
        return;
      }
      const clip = drumRackClips[Math.floor(Math.random() * drumRackClips.length)];
      try {
        await clip.fire();
      } catch (err) {
        Logger.error(
          err,
          `Error firing cauldron sample clip "${clip.raw.name}" - refreshing the drum-rack clip cache for the next attempt`,
        );
        // Stale-clip recovery: don't retry this fire (the tap is over), but
        // make sure the *next* tap gets a fresh cache rather than repeating
        // the same failure.
        await getDrumRackClips().catch((refetchErr) =>
          Logger.error(refetchErr, 'Error refetching drum-rack clips after a fire failure'),
        );
        return;
      }
      OutgoingEvents.emitEvent('cauldron_sample_triggered', { clipName: clip.raw.name });
    } catch (err) {
      Logger.error(err, 'Error triggering random cauldron sample');
    }
  },
  200,
  { trailing: false },
);

// Lazily fetches (and caches) the DeviceParameter for the drum-rack track's
// mixer volume - same pattern as getTrackVolumes/trackVolumes, but for the
// single non-pillar cauldron track (no pillar semantics apply here).
async function getCauldronVolumeParam(): Promise<DeviceParameter | undefined> {
  if (!isDrumRackTrackIndexValid) return undefined;
  const track = tracks[DRUM_RACK_TRACK_INDEX];
  if (!track) {
    Logger.warn(
      `Drum rack track index ${DRUM_RACK_TRACK_INDEX} not found - cauldron volume unavailable until getTracksAndClips is re-run`,
    );
    return undefined;
  }
  if (!cauldronVolumeParam) {
    const mixerDevice = await track.get('mixer_device');
    const deviceParameter = await mixerDevice.sendCommand('get_volume');
    cauldronVolumeParam = new DeviceParameter(ableton, deviceParameter);
  }
  return cauldronVolumeParam;
}

async function getCauldronVolume(): Promise<number> {
  const param = await getCauldronVolumeParam();
  // NOTE: raw.value is the snapshot from when the param was fetched, not a
  // live read — same limitation as get_track_volumes (see IncomingEvents).
  return param?.raw.value ?? DEFAULT_TRACK_VOLUME;
}

async function setCauldronVolume(volume: number): Promise<void> {
  const clampedVolume = clampVolume(volume);
  const param = await getCauldronVolumeParam();
  if (!param) {
    Logger.warn(`Cannot set cauldron volume to ${clampedVolume}: drum rack track unavailable`);
    return;
  }
  try {
    await param.set('value', clampedVolume);
  } catch (err) {
    // Same stale-recovery posture as the drum-rack clip cache: a failed set
    // usually means the cached DeviceParameter no longer matches the Live
    // set, so drop it and let the next call refetch (audio-ableton +
    // general reviews, PR #56).
    cauldronVolumeParam = undefined;
    Logger.error(err, 'Error setting cauldron volume - cleared cached volume parameter');
    return;
  }
  OutgoingEvents.emitEvent('cauldron_volume_changed', { volume: clampedVolume });
}

// Pure. Fewer than 2 markers, a zero/negative sample-time span, or a
// non-finite result all mean the clip's warp data can't produce a usable
// BPM - returns undefined rather than Infinity/NaN so callers can skip tempo
// adoption instead of pushing a broken tempo into Ableton (WOW-020).
function calculateBpmFromWarpMarkers(warpMarkers: WarpMarker[]): Maybe<number> {
  if (warpMarkers.length < 2) return undefined;
  const { beat_time: startBT, sample_time: startST } = warpMarkers[0];
  const { beat_time: endBT, sample_time: endST } = warpMarkers[warpMarkers.length - 1];
  const sampleTimeSpan = endST - startST;
  if (sampleTimeSpan <= 0) return undefined;
  const bpm = (endBT - startBT) / (sampleTimeSpan / 60);
  return Number.isFinite(bpm) ? bpm : undefined;
}

function getKeyLockState() {
  return keyLockEnabled;
}

function setKeyLockState(state: boolean) {
  keyLockEnabled = state;

  Logger.info(`Key lock: ${state}`);
  playingClips.forEach((song, pillar) => {
    song &&
      FindAllClipsInLoop(song.clipName, pillar).forEach((clip) => {
        clip && transposeClipToNewKey({ ...song, clip }, keyLockEnabled ? masterKey : '');
      });
  });
  queuedClips.forEach((song, pillar) => {
    song &&
      FindAllClipsInLoop(song.clipName, pillar).forEach((clip) => {
        clip && transposeClipToNewKey({ ...song, clip }, keyLockEnabled ? masterKey : '');
      });
  });
}

function getMasterKey() {
  return masterKey;
}

function setMasterKey(newKey: string) {
  masterKey = newKey;
  OutgoingEvents.emitEvent('master-key_changed', { key: newKey });
  if (keyLockEnabled) {
    playingClips.forEach((song, pillar) => {
      song &&
        FindAllClipsInLoop(song.clipName, pillar).forEach((clip) => {
          clip && transposeClipToNewKey({ ...song, clip }, newKey);
        });
    });
    queuedClips.forEach((song, pillar) => {
      song &&
        FindAllClipsInLoop(song.clipName, pillar).forEach((clip) => {
          clip && transposeClipToNewKey({ ...song, clip }, newKey);
        });
    });
  }
}

function transposeClipToNewKey(item: ClipInfo, newKey: string) {
  const { key, clip, clipName } = item;
  if (!newKey || key === newKey) {
    Logger.info(`Resetting clip "${clipName}" to original key`);
    clip
      .set('pitch_coarse', 0)
      .catch((err) => Logger.error(err, `Error resetting pitch for clip "${clipName}"`));
  } else if (key) {
    const trackKeyPitch = key.match(/[A-Z]/g)?.[0];
    const newKeyPitch = newKey.match(/[A-Z]/g)?.[0];
    const newKeyNumber = Number(newKey.match(/\d+/g)?.[0] ?? 1);
    const backupKey = `${newKeyNumber}${trackKeyPitch}`;
    const transposeAmount =
      (newKeyPitch === trackKeyPitch
        ? KeyTranspositionService.TRANSPOSITIONS[key][newKey]
        : KeyTranspositionService.TRANSPOSITIONS[key][backupKey]) ?? 0;

    Logger.info(
      `Transposing clip "${clipName}" from ${key} to ${
        newKeyPitch === trackKeyPitch ? newKey : backupKey
      } > ${transposeAmount ?? 0}`,
    );
    clip
      .set('pitch_coarse', transposeAmount)
      .catch((err) => Logger.error(err, `Error transposing clip "${clipName}"`));
  } else {
    Logger.warn(`Cannot transpose clip "${item.clipName}": it does not have a key`);
  }
}

export const AbletonAdapter = {
  TIMEOUT_WARNING_IN_MILLISECONDS,
  MIN_IDLE_TIMEOUT_MS,
  MAX_IDLE_TIMEOUT_MS,
  TRIGGER_ORDER,
  ABLETON_START_TIMEOUT_MS,
  DRUM_RACK_TRACK_INDEX,
  DEFAULT_TRACK_VOLUME,
  isDrumRackTrackIndexValid,
  rebuildPillarPlayingState,
  parseRemoteScriptVersion,
  ensureServerPortFile,
  clampVolume,
  ableton,
  sockets,
  playingClips,
  queuedClips,
  stoppingClips,
  // trackVolumes is reassigned inside this module; a getter preserves the
  // live-binding read semantics the old `export let` gave consumers.
  get trackVolumes() {
    return trackVolumes;
  },
  get tracks() {
    return tracks;
  },
  // drumRackClips is reassigned wholesale inside this module (unlike
  // trackVolumes/tracks); a getter still exposes the current cache for
  // tests/inspection, it just isn't a live-mutable reference.
  get drumRackClips() {
    return drumRackClips;
  },
  startAbleton,
  connectOscServer,
  addWebSocket,
  queueClip,
  triggerQueuedClips,
  stopOrRemoveClipFromQueue,
  addPhraseLeader,
  getTracksAndClips,
  getTempo,
  setTempo,
  getTrackVolumes,
  setTrackVolume,
  resolveClipStartVolume,
  calculateBpmFromWarpMarkers,
  getKeyLockState,
  setKeyLockState,
  getMasterKey,
  setMasterKey,
  transposeClipToNewKey,
  handleTimeout,
  stopAllClipsBestEffort,
  startTimeoutTimer,
  restartTimeoutTimer,
  getIdleTimeoutConfig,
  setIdleTimeoutConfig,
  getDjModeActive,
  setDjModeActive,
  handleLastWebClientDisconnected,
  getDrumRackClips,
  triggerRandomDrumSample,
  getCauldronVolume,
  setCauldronVolume,
};
