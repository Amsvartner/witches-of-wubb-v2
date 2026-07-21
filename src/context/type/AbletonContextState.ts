import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { IdleTimeoutConfigType } from 'backend/type/IdleTimeoutConfigType';
import { SetTrackVolumeInputType } from 'backend/type/SetTrackVolumeInputType';

export type AbletonContextState = {
  getTracksAndClips: () => void;
  changeTempo: (x: number) => void;
  changeTrackVolume: (input: SetTrackVolumeInputType) => void;
  tempo: number;
  trackVolume: number[];
  queuedClips: BrowserClipInfoList;
  playingClips: BrowserClipInfoList;
  stoppingClips: BrowserClipInfoList;
  clipTempo: (number | null)[];
  masterKey: string;
  changeMasterKey: (key: string) => void;
  keylock: boolean;
  changeKeylock: (keylock: boolean) => void;
  /** WOW-007C: fires a random one-shot from the drum-rack ("cauldron") track. */
  triggerCauldronSample: () => void;
  /** WOW-007C: cauldron (drum-rack track) loudness, independent of pillar volumes. */
  cauldronVolume: number;
  changeCauldronVolume: (volume: number) => void;
  /** WOW-007C: idle-timeout ("pause music"/attractor handover) config. */
  idleTimeout: IdleTimeoutConfigType;
  changeIdleTimeout: (config: IdleTimeoutConfigType) => void;
  /**
   * WOW-007C item 4: tells the backend whether DJ mode is active, so the
   * idle timeout can never hand over to the Live-set attractor while a DJ is
   * supervising the installation. No ack (frozen contract, fire-and-forget)
   * — PlayModeContainer is the sole caller, emitting on every mode change
   * and on every (re)connect (backend-side state isn't persisted).
   */
  setDjMode: (active: boolean) => void;
};
