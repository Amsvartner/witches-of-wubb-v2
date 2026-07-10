import { ClipTypes } from './ClipTypes';

export type ClipMetadataType = {
  rfid: string;
  clipName: string;
  type: ClipTypes;
  assetName: string;
  artist?: string;
  songTitle?: string;
  bpm?: number;
  key?: string;
  ingredientName?: string;
  recommendedClips?: {
    [key: string]: Omit<ClipMetadataType, 'recommendedClips'>[]; // name of the clips as surfaced from the CSV
  };
  // recommendedSpells?: { [key in keyof ClipTypes]: ClipMetadataType }[];
};
