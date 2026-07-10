import type { Clip } from 'ableton-js/ns/clip';
import { ClipMetadataType } from './ClipMetadataType';

export type ClipInfo = { clip: Clip; pillar: number } & ClipMetadataType;
