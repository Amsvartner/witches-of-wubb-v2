import { Ableton } from 'ableton-js';
import { Track } from 'ableton-js/ns/track';
import { DeviceParameter } from 'ableton-js/ns/device-parameter';
import * as socketio from 'socket.io';
import * as nodeOSC from 'node-osc';
import throttle from 'lodash.throttle';
import memoize from 'lodash.memoize';
import { LoggerUtil } from '../util/LoggerUtil';
import { PhraseLeaderService } from '../service/PhraseLeaderService';
import { ClipBoard } from '../type/ClipBoard';
import { ClipInfo } from '../type/ClipInfo';
import { ClipList } from '../type/ClipList';
import { ClipMetadataType } from '../type/ClipMetadataType';
import { ClipTypes } from '../type/ClipTypes';
import { WarpMarker } from '../type/WarpMarker';

import { OutgoingEvents } from '../event/OutgoingEvents';
import { IncomingEvents } from '../event/IncomingEvents';
import { MusicDatabaseService } from '../service/MusicDatabaseService';
import { KeyTranspositionService } from '../service/KeyTranspositionService';

const logger = LoggerUtil.logger;

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
let phraseLeader: ClipInfo;
let cleanUpPhraseLeaderEventListener: (() => unknown) | undefined;

let keyLockEnabled = true;
let masterKey = '';
const stoppingClips: ClipList = [];
const playingClips: ClipList = [];
const queuedClips: ClipList = [];

const ableton = new Ableton({ logger: logger });

const TRIGGER_ORDER = [ClipTypes.Drums, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Vox];
const KEY_LEADER_ORDER = [ClipTypes.Vox, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Drums];

async function startAbleton() {
  logger.info('Starting AbletonJS');
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
  logger.info('Starting timeout timer');
  function shouldShowTimeout() {
    return (
      playingClips.filter((clip) => clip).length > 0 &&
      stoppingClips.filter((clip) => clip).length === 0
    );
  }
  timeoutWarningId = setTimeout(() => {
    if (shouldShowTimeout()) {
      logger.warn('Timeout warning');
      OutgoingEvents.emitEventWithoutResetingTimout('timeout_warning');
    }
  }, TIMEOUT_IN_MILISECONDS - TIMEOUT_WARNING_IN_MILISECONDS);
  timeoutId = setTimeout(() => {
    if (shouldShowTimeout()) {
      logger.warn('Timeout exceeded, restarting the UI');
      handleTimeout();
    }
  }, TIMEOUT_IN_MILISECONDS);
}

function restartTimeoutTimer() {
  logger.warn('Restarting timeout timer');
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
    logger.info('Web client disconnected');
    const disconnectedSocketIndex = sockets.findIndex((socket) => socket === s);
    sockets.splice(disconnectedSocketIndex, 1);
  });
  sockets.push(s);
  IncomingEvents.addSocketEventsHandlers(s);
}

const FindAllClipsInLoop = memoize(
  (clipName, pillar) => {
    logger.info(`Trying to find all clips in loop on pillar ${pillar + 1} > ${clipName}`);
    const firstClipIndex = MemoizedClipIndex(clipName, pillar);
    if (firstClipIndex < 0) return [];

    const lastClipIndex = allAbletonClips[pillar]
      .slice(firstClipIndex, firstClipIndex + 20)
      .findLastIndex((clip) => {
        return clip?.raw.name.trim() === clipName.trim();
      });
    logger.debug(
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
  logger.info(`Begin queing clip ${clipName}`);
  if (queuedClips[pillar]?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '')) {
    logger.info(`Clip ${clipName} is already queued`);
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
      logger.info(`Triggering clip "${clipName}" on pillar ${pillar + 1}`);
      clips[0]?.fire();
    } else if (clips[0]) {
      logger.info(`Queuing clip "${clipName}" on pillar ${pillar + 1}`);
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
    logger.warn(`No clip "${clipName}" found on pillar ${pillar + 1}`);
    OutgoingEvents.emitEvent('clip_unqueued', {
      ...clipMetadata,
      pillar,
    });
  }
}

async function triggerQueuedClips() {
  logger.info(`Begin triggering clip queue`);
  for (let i = 0; i < queuedClips.length; i++) {
    const item = queuedClips[i];
    if (!item) continue;
    logger.info(`Triggering clip "${item.clip.raw.name}" on pillar ${item.pillar} `);
    await item.clip.fire();
    queuedClips[item.pillar] = null;
  }
}

async function stopOrRemoveClipFromQueue(clipName: string, pillar: number) {
  logger.trace(`Try to stop or unqueue clip ${clipName}`);
  const playingClip = playingClips[pillar];
  const queuedClip = queuedClips[pillar];

  const isClipPlaying =
    playingClip?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '');
  if (isClipPlaying) {
    logger.info(`Stopping clip "${clipName}" on pillar ${pillar + 1}`);
    stoppingClips[pillar] = playingClip;
    // clip.stop() won't work because of looping: stop the whole track instead.
    OutgoingEvents.emitEvent('clip_stopping', {
      ...playingClip,
      clip: undefined,
    });
    await tracks[pillar].sendCommand('stop_all_clips');

    playingClips[pillar] = null;
    if (playingClip.clipName.replace(/[* ]/g, '') === phraseLeader.clipName.replace(/[* ]/g, '')) {
      // Find the next phrase leader, check if such a clip is playing,
      // then promote that clip to phrase leader else trigger queued clips and let god sort it out.
      const promotedClip = PhraseLeaderService.findNextPhraseLeader(playingClips);
      if (promotedClip) {
        addPhraseLeader(promotedClip);
      } else {
        triggerQueuedClips();
      }
    }
  }

  // check if the clip is queued
  const isClipQueued = queuedClip?.clipName.replace(/[* ]/g, '') === clipName.replace(/[* ]/g, '');
  if (isClipQueued) {
    logger.info(`Removing clip from queue "${clipName}" on pillar ${pillar + 1}`);
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
    logger.warn(
      `Clip ${clipName} is neither playing or queue. Stopping pillar ${pillar + 1} just in case.`,
    );
    await tracks[pillar].sendCommand('stop_all_clips');
    OutgoingEvents.emitEventWithoutResetingTimout('clip_stopped', { pillar });
  }
}

async function addPhraseLeader(newPhraseLeader: ClipInfo) {
  if (cleanUpPhraseLeaderEventListener) cleanUpPhraseLeaderEventListener();
  phraseLeader = newPhraseLeader;

  const { clip, clipName, pillar } = newPhraseLeader;
  logger.info(`New phrase leader "${clipName}" on pillar ${pillar + 1}`);

  // figure out when this clip is about to end
  const endTime = await clip.get('loop_end');
  logger.debug(`Loop end on pillar ${pillar + 1} > "${clipName}" | ${endTime}`);
  cleanUpPhraseLeaderEventListener = await clip.addListener(
    'playing_position',
    throttle(
      function (clip: ClipInfo, endTime: number, currentTime: number) {
        if (currentTime >= endTime - 1) {
          logger.info(
            `Clip ending soon on pillar ${clip.pillar} > "${clip.clipName}" | ${currentTime} / ${endTime}`,
          );
          if (cleanUpPhraseLeaderEventListener) cleanUpPhraseLeaderEventListener();
          triggerQueuedClips();
        }
      }.bind({}, newPhraseLeader, endTime),
      300,
    ),
  );
}

const getTracksAndClips = async () => {
  logger.info('Fetching tracks and clips from Ableton');
  // 2-D array of all the clips, ordered by Track
  allAbletonClips = [];
  tracks = await ableton.song.get('tracks');

  for (let pillar = 0; pillar < 4; pillar++) {
    const track = tracks[pillar];
    const clipSlots = await track.get('clip_slots');

    track.addListener('playing_slot_index', async (clipSlotIndex: number) => {
      logger.info('Playing slot index changed: ' + clipSlotIndex);
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

          logger.info(`Pillar ${pillar + 1} started playing ${clipName}`);
          if (!clipMetadata) {
            throw new Error(`Couldn't find clip metadata for "${clipName}"`);
          }

          if (playingClips[pillar]?.clipName && clipName !== playingClips[pillar]?.clipName) {
            // In the case where a whole new song gets queued and triggered without the previous
            // song being stopped, we need to make sure that we transpose the previous song back to 0
            const previousClipsInLoop = FindAllClipsInLoop(playingClips[pillar]?.clipName, pillar);
            previousClipsInLoop.forEach(
              (clip) =>
                clip && transposeClipToNewKey({ ...(playingClips[pillar] as ClipInfo), clip }, ''),
            );
          }

          const warpMarkers = await clip.get('warp_markers');
          const bpm = calculateBpmFromWarpMarkers(warpMarkers);
          const browserInfo = { ...clipInfo, bpm };
          if (playingClips[pillar]?.clipName === clipName) {
            OutgoingEvents.emitEventWithoutResetingTimout('clip_playing', browserInfo);
          } else {
            OutgoingEvents.emitEvent('clip_started', browserInfo);
            setTrackVolume(pillar, 0.6);
          }
          if (playingClips.every((item) => !item)) {
            // we're coming from a silent state, so let's set the tempo to this new clip's bpm
            setTempo(bpm);
            clipMetadata.key && setMasterKey(clipMetadata.key);
          }

          playingClips[pillar] = { ...clipInfo, clip };

          const newPhraseLeader = PhraseLeaderService.findNextPhraseLeader(playingClips);
          if (newPhraseLeader?.clipName === clipName) {
            addPhraseLeader(newPhraseLeader);
          }
        }
      } else {
        const clipInfo = stoppingClips[pillar];
        logger.info(`Clip stopped playing on pillar ${pillar + 1} > "${clipInfo?.clipName}"`);
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
    });

    allAbletonClips.push([]);

    for (let clipSlotIndex = 0; clipSlotIndex < clipSlots.length; clipSlotIndex++) {
      const cs = clipSlots[clipSlotIndex];
      const clip = await cs.get('clip');
      allAbletonClips[pillar].push(clip);
    }
  }
  logger.info('Tracks and clips from Ableton fetched');

  return { allAbletonClips, tracks };
};

async function getTempo() {
  logger.info('Getting tempo');
  return ableton.song.get('tempo');
}

function setTempo(tempo: number) {
  logger.info(`Setting tempo to: ${tempo}`);
  ableton.song.set('tempo', tempo);
  OutgoingEvents.emitEvent('tempo_changed', { tempo });
}

async function getTrackVolumes() {
  logger.info('Getting track volumes');
  trackVolumes = [];
  for (const track of tracks.slice(0, 4)) {
    const mixerDevice = await track.get('mixer_device');
    const deviceParameter = await mixerDevice.sendCommand('get_volume');
    logger.debug(
      `Getting volume device parameter for track ${track.raw.name}: ${JSON.stringify(
        deviceParameter,
      )}`,
    );
    trackVolumes.push(new DeviceParameter(ableton, deviceParameter));
  }
}

async function setTrackVolume(pillar: number, volume: number) {
  logger.info(`Setting volume for pillar ${pillar + 1} to ${volume}`);
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

  logger.info(`Key lock: ${state}`);
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
    logger.info(`Resetting clip "${clipName}" to original key`);
    clip.set('pitch_coarse', 0);
  } else if (key) {
    const trackKeyPitch = key.match(/[A-Z]/g)?.[0];
    const newKeyPitch = newKey.match(/[A-Z]/g)?.[0];
    const newKeyNumber = Number(newKey.match(/\d+/g)?.[0] ?? 1);
    const backupKey = `${newKeyNumber}${trackKeyPitch}`;
    const transposeAmount =
      (newKeyPitch === trackKeyPitch
        ? KeyTranspositionService.TRANSPOSITIONS[key][newKey]
        : KeyTranspositionService.TRANSPOSITIONS[key][backupKey]) ?? 0;

    logger.info(
      `Transposing clip "${clipName}" from ${key} to ${
        newKeyPitch === trackKeyPitch ? newKey : backupKey
      } > ${transposeAmount ?? 0}`,
    );
    clip.set('pitch_coarse', transposeAmount);
  } else {
    logger.warn(`Cannot transpose clip "${item.clipName}": it does not have a key`);
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
