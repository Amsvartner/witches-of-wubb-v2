import type { ArgumentType, RequestInfo } from 'node-osc';
import { Socket } from 'socket.io';
import { MusicDatabaseService } from '../service/MusicDatabaseService';
import { Logger } from '../util/Logger';
import { OutgoingEvents } from './OutgoingEvents';
import { AbletonAdapter } from '../adapter/AbletonAdapter';
import { BrowserClipInfo } from '../type/BrowserClipInfo';
import { BrowserClipInfoList } from '../type/BrowserClipInfoList';
import { IdleTimeoutConfigType } from '../type/IdleTimeoutConfigType';
import { SetCauldronVolumeInputType } from '../type/SetCauldronVolumeInputType';
import { SetTrackVolumeInputType } from '../type/SetTrackVolumeInputType';
import { TagDetectionData } from '../type/TagDetectionData';
import { TrackVolumesType } from '../type/TrackVolumesType';

const IP_ADDRESS_TO_PILLAR_INDEX_MAP: Record<string, number> = {
  '192.168.0.101': 0,
  '192.168.0.102': 1,
  '192.168.0.103': 2,
  '192.168.0.104': 3,
};

function getPillarIPAddressFromIndex(index: number) {
  return Object.entries(IP_ADDRESS_TO_PILLAR_INDEX_MAP).find(([_, i]) => i === index)?.[0] ?? '';
}

type IncomingEventSpec = {
  osc: boolean;
  websocket: boolean;
  oscHandler: (message: [string, ...ArgumentType[]], rinfo: RequestInfo) => void;
  wsHandler: (data: TagDetectionData) => void;
};

// This is a list of incoming events, their source, and their handlers
const incomingEvents: { [key: string]: IncomingEventSpec } = {
  '/new/tag': {
    osc: true,
    websocket: true,
    oscHandler: (message: [string, ...ArgumentType[]], rinfo: RequestInfo) => {
      const [_, tag] = message;
      handleNewTag(tag as string, rinfo.address);
    },
    wsHandler: (data: TagDetectionData) => {
      const pillarAddress = getPillarIPAddressFromIndex(data.pillar);
      handleNewTag(data.rfid, pillarAddress);
    },
  },
  '/departed/tag': {
    osc: true,
    websocket: true,
    oscHandler: (message: [string, ...ArgumentType[]], rinfo: RequestInfo) => {
      const [_, tag] = message;
      handleDepartedTag(tag as string, rinfo.address);
    },
    wsHandler: (data: TagDetectionData) => {
      const pillarAddress = getPillarIPAddressFromIndex(data.pillar);
      handleDepartedTag(data.rfid, pillarAddress);
    },
  },
};

function handleNewTag(rfid: string, requestAddress: string) {
  Logger.info(`New tag detected with ${rfid} from machine: ${requestAddress}`);
  try {
    const clipMetadata = MusicDatabaseService.rfidToClipMap[rfid as string];
    if (clipMetadata) {
      Logger.info(`RFID ${rfid} maps to clip ${clipMetadata?.clipName}`);
      const pillar = IP_ADDRESS_TO_PILLAR_INDEX_MAP[requestAddress];
      if (pillar === undefined) {
        Logger.warn(
          `Tag event from unrecognized IP address "${requestAddress}" (rfid ${rfid}) - ignoring, no pillar mapping`,
        );
        return;
      }
      OutgoingEvents.emitEvent('ingredient_detected', {
        ...clipMetadata,
        rfid,
        pillar,
        requestAddress,
      });
      AbletonAdapter.queueClip({ ...clipMetadata, rfid }, pillar);
    } else {
      Logger.warn("Couldn't find track from RFID tag");
    }
  } catch (err) {
    Logger.error(err, `Errored trying to find track from RFID tag ${rfid} (${requestAddress})`);
  }
}

function handleDepartedTag(rfid: string, requestAddress: string) {
  Logger.info(`Departed tag detected with ${rfid} from machine: ${requestAddress}`);
  try {
    const clipMetadata = MusicDatabaseService.rfidToClipMap[rfid as string];
    if (clipMetadata) {
      Logger.info(`RFID ${rfid} maps to clip ${clipMetadata.clipName} > type ${clipMetadata.type}`);
      const pillar = IP_ADDRESS_TO_PILLAR_INDEX_MAP[requestAddress];
      if (pillar === undefined) {
        Logger.warn(
          `Tag event from unrecognized IP address "${requestAddress}" (rfid ${rfid}) - ignoring, no pillar mapping`,
        );
        return;
      }

      OutgoingEvents.emitEvent('ingredient_removed', { ...clipMetadata, pillar, requestAddress });
      AbletonAdapter.stopOrRemoveClipFromQueue(clipMetadata.clipName, pillar).catch((err) =>
        Logger.error(err, `Error stopping or removing clip from queue on pillar ${pillar + 1}`),
      );
    } else {
      Logger.warn("Couldn't find track from RFID tag");
    }
  } catch (err) {
    Logger.error(err, `Errored trying to find track from RFID tag ${rfid} (${requestAddress})`);
  }
}

function addSocketEventsHandlers(socket: Socket) {
  Object.entries(incomingEvents).forEach(([eventName, event]) => {
    if (event.websocket) {
      socket.on(eventName, event.wsHandler);
    }
  });

  socket.on('get_playing_clips', (_, callback) => {
    const clips: BrowserClipInfoList = AbletonAdapter.playingClips.map((data) => {
      if (data) {
        const { pillar, clipName, type, assetName, rfid, artist, songTitle } = data;
        const bci: BrowserClipInfo = {
          pillar,
          clipName,
          type,
          assetName,
          rfid,
          artist,
          songTitle,
        };
        return bci;
      }
      return data;
    });
    callback(clips);
  });
  socket.on('get_queued_clips', (_, callback) => {
    const clips: BrowserClipInfoList = AbletonAdapter.queuedClips.map((data) => {
      if (data) {
        const { pillar, clipName, type, assetName, rfid, artist, songTitle } = data;
        const bci: BrowserClipInfo = {
          pillar,
          clipName,
          type,
          assetName,
          rfid,
          artist,
          songTitle,
        };
        return bci;
      }
      return data;
    });
    callback(clips);
  });
  socket.on('get_tempo', async (_, callback) => {
    try {
      const tempo = await AbletonAdapter.getTempo();
      callback(tempo);
    } catch (err) {
      Logger.error(err, 'Error getting tempo');
    }
  });
  socket.on('set_tempo', (tempo: number, callback) => {
    AbletonAdapter.setTempo(tempo);
    callback(tempo);
  });
  socket.on('get_track_volumes', async (_, callback) => {
    try {
      if (!AbletonAdapter.trackVolumes?.length) await AbletonAdapter.getTrackVolumes();
      const formattedVolumes: TrackVolumesType = AbletonAdapter.trackVolumes.map(
        (trackVolume) => trackVolume?.raw.value,
      );
      Logger.info(`Emitting track volumes: ${formattedVolumes}`);
      callback(formattedVolumes);
    } catch (err) {
      Logger.error(err, 'Error getting track volumes');
    }
  });
  socket.on('set_track_volume', async ({ pillar, volume }: SetTrackVolumeInputType) => {
    try {
      await AbletonAdapter.setTrackVolume(pillar, volume);
    } catch (err) {
      Logger.error(err, `Error setting track volume for pillar ${pillar + 1}`);
    }
  });
  socket.on('get_keylock_state', (_, callback) => {
    callback(AbletonAdapter.getKeyLockState());
  });
  socket.on('set_keylock_state', (state: boolean, callback) => {
    AbletonAdapter.setKeyLockState(state);
    callback(AbletonAdapter.getKeyLockState());
  });
  socket.on('get_master-key', (_, callback) => {
    callback(AbletonAdapter.getMasterKey());
  });
  socket.on('set_master-key', (newKey: string) => {
    AbletonAdapter.setMasterKey(newKey);
  });

  // WOW-007C: cauldron drum-rack sample trigger.
  socket.on('trigger_cauldron_sample', async () => {
    try {
      await AbletonAdapter.triggerRandomDrumSample();
    } catch (err) {
      Logger.error(err, 'Error triggering cauldron sample');
    }
  });

  // WOW-007C: cauldron (drum-rack track) loudness, independent of the pillar
  // volumes - ack callback defaults to 0.6 on error so the UI has a sane
  // display value instead of hanging on a callback that never fires.
  socket.on('get_cauldron_volume', async (_, callback) => {
    try {
      const volume = await AbletonAdapter.getCauldronVolume();
      callback(volume);
    } catch (err) {
      Logger.error(err, 'Error getting cauldron volume');
      callback(0.6);
    }
  });
  socket.on('set_cauldron_volume', async ({ volume }: SetCauldronVolumeInputType) => {
    try {
      await AbletonAdapter.setCauldronVolume(volume);
    } catch (err) {
      Logger.error(err, 'Error setting cauldron volume');
    }
  });

  // WOW-007C: idle-timeout ("pause music"/attractor handover) config.
  socket.on('get_idle_timeout', (_, callback) => {
    try {
      callback(AbletonAdapter.getIdleTimeoutConfig());
    } catch (err) {
      Logger.error(err, 'Error getting idle timeout config');
    }
  });
  socket.on(
    'set_idle_timeout',
    (config: IdleTimeoutConfigType, callback?: (result: IdleTimeoutConfigType) => void) => {
      try {
        const result = AbletonAdapter.setIdleTimeoutConfig(config);
        callback?.(result);
      } catch (err) {
        Logger.error(err, 'Error setting idle timeout config');
      }
    },
  );

  return socket;
}

function oscEventHandlers(message: [string, ...ArgumentType[]], rinfo: RequestInfo) {
  const [eventName] = message;
  if (incomingEvents[eventName]?.osc) {
    incomingEvents[eventName].oscHandler(message, rinfo);
  }
}

export const IncomingEvents = {
  IP_ADDRESS_TO_PILLAR_INDEX_MAP,
  getPillarIPAddressFromIndex,
  addSocketEventsHandlers,
  oscEventHandlers,
};
