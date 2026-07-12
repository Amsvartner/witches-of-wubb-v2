import { Ableton } from 'ableton-js';
import { Track } from 'ableton-js/ns/track';
import { DeviceParameter } from 'ableton-js/ns/device-parameter';
import * as socketio from 'socket.io';
import * as nodeOSC from 'node-osc';
import throttle from 'lodash.throttle';
import memoize from 'lodash.memoize';
import { Logger } from '../util/Logger';
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
const TIMEOUT_IN_MILISECONDS = 60 * 3 * 1000; // three minutes
const TIMEOUT_WARNING_IN_MILISECONDS = 30 * 1000; // thirty seconds

let timeoutId: NodeJS.Timeout;
let timeoutWarningId: NodeJS.Timeout;
const ATTRACTOR_STATE_CLIP_NAME = 'Wicked Casting';
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
const KEY_LEADER_ORDER = [ClipTypes.Vox, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Drums];

async function startAbleton() {
  Logger.info('Starting AbletonJS');
  await ableton.start();
  await getTracksAndClips();
  await getTrackVolumes();
}

async function handleTimeout() {
  for (let i = 0; i < 4; i++) {
    await tracks[i].sendCommand('stop_all_clips');
  }
  masterKey = '';
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
      OutgoingEvents.emitEventWithoutResetingTimout('timeout_warning');
    }
  }, TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS);
  timeoutId = setTimeout(() => {
    if (shouldShowTimeout()) {
      Logger.warn('Timeout exceeded, restarting the UI');
      handleTimeout().catch((err) => Logger.error(err, 'Error handling idle timeout'));
    }
  }, TIMEOUT_IN_MILISECONDS);
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

const MemoizedClipIndex = memoize(
  (clipName, pillar) =>
    allAbletonClips[pillar].findIndex((clip) => {
      return clip?.raw.name.trim() === clipName.trim();
    }),
  (clipName, pillar) => `${clipName}-${pillar}`,
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

    const lastClipIndex = allAbletonClips[pillar]
      .slice(firstClipIndex, firstClipIndex + 20)
      .findLastIndex((clip) => {
        return clip?.raw.name.trim() === clipName.trim();
      });
    Logger.debug(
      `Loop for ${clipName} found on ${pillar + 1} > [${firstClipIndex}, ${
        firstClipIndex + lastClipIndex + 1
      }]`,
    );
    return allAbletonClips[pillar].slice(firstClipIndex, firstClipIndex + lastClipIndex + 1);
  },
  (clipName, pillar) => `${clipName}-${pillar}`,
);

function queueClip(clipMetadata: ClipMetadataType, pillar: number) {
  const { clipName, key } = clipMetadata;
  Logger.info(`Begin queing clip ${clipName}`);
  if (queuedClips[pillar]?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '')) {
    Logger.info(`Clip ${clipName} is already queued`);
    return;
  }
  const clips = FindAllClipsInLoop(clipName, pillar);
  console.log('clips', clips);
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
    playingClip?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '');
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
      playingClip.clipName.replace(/[* ]/g, '') === phraseLeader.clipName.replace(/[* ]/g, '')
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
  const isClipQueued = queuedClip?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '');
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
    OutgoingEvents.emitEventWithoutResetingTimout('clip_stopped', { pillar });
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
                MusicDatabaseService.clipNameToInfoMap[clipName.replace(/[* ]/g, '')];
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
              const browserInfo = { ...clipInfo, bpm };
              if (playingClips[pillar]?.clipName === clipName) {
                OutgoingEvents.emitEventWithoutResetingTimout('clip_playing', browserInfo);
              } else {
                OutgoingEvents.emitEvent('clip_started', browserInfo);
                setTrackVolume(pillar, 0.6).catch((err) =>
                  Logger.error(err, `Error setting track volume on pillar ${pillar + 1}`),
                );
              }
              if (playingClips.every((item) => !item)) {
                // we're coming from a silent state, so let's set the tempo to this new clip's bpm
                setTempo(bpm);
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
            OutgoingEvents.emitEventWithoutResetingTimout('clip_stopped', {
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

function calculateBpmFromWarpMarkers(warp_markers: WarpMarker[]) {
  const { beat_time: startBT, sample_time: startST } = warp_markers[0];
  const { beat_time: endBT, sample_time: endST } = warp_markers.slice(-1)[0];
  const bpm = (endBT - startBT) / ((endST - startST) / 60);
  return bpm;
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
  TIMEOUT_IN_MILISECONDS,
  TIMEOUT_WARNING_IN_MILISECONDS,
  ATTRACTOR_STATE_CLIP_NAME,
  TRIGGER_ORDER,
  KEY_LEADER_ORDER,
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
  startTimeoutTimer,
  restartTimeoutTimer,
};
