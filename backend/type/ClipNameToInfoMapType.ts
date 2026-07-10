import { ClipMetadataType } from './ClipMetadataType';

export type ClipNameToInfoMapType = {
  [key: string]: Omit<ClipMetadataType, 'clipName'>;
};
