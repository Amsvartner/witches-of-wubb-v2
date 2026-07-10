import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
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
};
