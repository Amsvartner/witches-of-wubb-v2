import { ClipMetadataType } from './ClipMetadataType';

export type RFIDToClipMapType = {
  [key: string]: Omit<ClipMetadataType, 'rfid'>;
};
