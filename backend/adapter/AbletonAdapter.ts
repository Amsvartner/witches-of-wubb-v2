import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Ableton } from 'ableton-js';
import { Track } from 'ableton-js/ns/track';
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
import { Maybe } from '../type/Maybe';
import { WarpMarker } from '../type/WarpMarker';

import { OutgoingEvents } from '../event/OutgoingEvents';
import { IncomingEvents } from '../event/IncomingEvents';
import { MusicDatabaseService } from '../service/MusicDatabaseService';
import { KeyTranspositionService } from '../service/KeyTranspositionService';

let oscServer: nodeOSC.Server;
const sockets: socketio.Socket[] = [];
const TIMEOUT_IN_MILLISECONDS = 60 * 3 * 1000; // three minutes
const TIMEOUT_WARNING_IN_MILLISECONDS = 30 * 1000; // thirty seconds

// WOW-032: bounded startup connection timeout + remote-script version diagnostics.
const ABLETON_START_TIMEOUT_MS = Number(process.env.ABLETON_START_TIMEOUT_MS) || 45000;
const DEFAULT_REMOTE_SCRIPT_VERSION_PATH = path.join(
  os.homedir(),
  'Music/Ableton/User Library/Remote Scripts/AbletonJS/version.py',
);

let timeoutId: NodeJS.Timeout;
let timeoutWarningId: NodeJS.Timeout;
let allAbletonClips: ClipBoard;
let tracks: Track[];
let trackVolumes: Array<DeviceParameter>;
let phraseLeader: Maybe<ClipInfo>;
let cleanUpPhraseLeaderEventListener: (() => Promise<unknown>) | undefined;

let keyLockEnabled = true;
let masterKey = '';
const stoppingClips: ClipList = [];
const playingClips: ClipList = [];
const queuedClips: ClipList = [];

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

async function startAbleton() {
  Logger.info('Starting AbletonJS');
  checkRemoteScriptVersionPreflight();
  try {
    await ableton.start(ABLETON_START_TIMEOUT_MS);
  } catch (err) {
    throw new Error(
      `Failed to connect to Ableton within ${ABLETON_START_TIMEOUT_MS}ms. Common causes: ` +
        "(1) Live isn't running; (2) the AbletonJS control surface isn't enabled in Live " +
        "Preferences → Link/Tempo/MIDI; (3) the installed remote-script version doesn't " +
        'match this npm package (see the pre-flight version check above). Remediation for (3): ' +
        "copy backend/node_modules/ableton-js/midi-script/ into Live's Remote Scripts folder " +
        'as "AbletonJS" and restart Live.',
      { cause: err instanceof Error ? err : new Error(String(err)) },
    );
  }
  await logConnectedRemoteScriptVersion();
  await getTracksAndClips();
  await getTrackVolumes();
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
  Logger.info('Starting timeout timer');
  function shouldShowTimeout() {
    return (
      playingClips.filter((clip) => clip).length > 0 &&
      stoppingClips.filter((clip) => clip).length === 0
    );
  }
  timeoutWarningId = setTimeout(() => {
    if (shouldShowTimeout()) {
      Logger.warn('Timeout warning');
      OutgoingEvents.emitEventWithoutResettingTimeout('timeout_warning');
    }
  }, TIMEOUT_IN_MILLISECONDS - TIMEOUT_WARNING_IN_MILLISECONDS);
  timeoutId = setTimeout(() => {
    if (shouldShowTimeout()) {
      Logger.warn('Timeout exceeded, restarting the UI');
      handleTimeout().catch((err) => Logger.error(err, 'Error handling idle timeout'));
    }
  }, TIMEOUT_IN_MILLISECONDS);
}

function restartTimeoutTimer() {
  Logger.warn('Restarting timeout timer');
  clearTimeout(timeoutId);
  clearTimeout(timeoutWarningId);
  startTimeoutTimer();
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
  tracks = await ableton.song.get('tracks');

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
                setTrackVolume(pillar, 0.6).catch((err) =>
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
  }
  Logger.info('Tracks and clips from Ableton fetched');

  return { allAbletonClips, tracks };
};

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
  trackVolumes = [];
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
  Logger.info(`Setting volume for pillar ${pillar + 1} to ${volume}`);
  if (!trackVolumes?.length) await getTrackVolumes();
  const trackVolume = trackVolumes[pillar];
  await trackVolume?.set('value', volume);
  OutgoingEvents.emitEvent('volume_changed', { pillar, volume });
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
  TIMEOUT_IN_MILLISECONDS,
  TIMEOUT_WARNING_IN_MILLISECONDS,
  TRIGGER_ORDER,
  ABLETON_START_TIMEOUT_MS,
  parseRemoteScriptVersion,
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
};
