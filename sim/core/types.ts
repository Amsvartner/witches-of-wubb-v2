/**
 * Browser-facing contract types, mirrored from `backend/types.ts`.
 *
 * Deliberately duplicated instead of imported: ADR-001 and the WOW-003 safety
 * notes require zero import paths from `sim/**` into backend runtime modules
 * (`backend/types.ts` imports from `ableton-js`). Any change to the originals
 * must be mirrored here — the reviewer checks contract fidelity on every
 * sim-adjacent diff.
 */

// Mirrors ClipTypes (backend/types.ts:3)
export enum ClipTypes {
  Vox = 'Vox',
  Melody = 'Melody',
  Bass = 'Bass',
  Drums = 'Drums',
}

// Mirrors TagDetectionData (backend/types.ts:15)
export type TagDetectionData = { rfid: string; pillar: number };

// Mirrors ClipMetadataType (backend/types.ts:17) minus the fields the real
// backend never populates from the CSV (`bpm` is derived from Ableton warp
// markers, never stored on the metadata map — see backend/utils/parse-csv.ts).
export type ClipMetadataType = {
  rfid: string;
  clipName: string;
  type: ClipTypes;
  assetName: string;
  artist?: string;
  songTitle?: string;
  key?: string;
  ingredientName?: string;
  recommendedClips?: {
    [key: string]: Omit<ClipMetadataType, 'recommendedClips'>[];
  };
};

// Mirrors BrowserClipInfo = Omit<ClipInfo, 'clip'> (backend/types.ts:41):
// clip metadata plus the pillar it sits on.
export type BrowserClipInfo = ClipMetadataType & { pillar: number };

// Mirrors BrowserClipInfoList (backend/types.ts:42)
export type BrowserClipInfoList = (BrowserClipInfo | null)[];

// Mirrors SetTrackVolumeInputType / TrackVolumesType (backend/types.ts:47-48)
export type SetTrackVolumeInputType = { pillar: number; volume: number };
export type TrackVolumesType = number[];

// Metadata keyed by RFID, as built by backend/utils/parse-csv.ts (rfid lives
// in the key, not the value — mirrors RFIDToClipMapType, backend/types.ts:33).
export type RFIDToClipMapType = {
  [key: string]: Omit<ClipMetadataType, 'rfid'>;
};

// WOW-007C: mirrors backend/type/SetCauldronVolumeInputType.ts — the
// `set_cauldron_volume` socket payload.
export type SetCauldronVolumeInputType = { volume: number };

// WOW-007C: mirrors backend/type/IdleTimeoutConfigType.ts — the idle-timeout
// ("pause music"/attractor handover) config, shared by
// `get_idle_timeout`/`set_idle_timeout`.
export type IdleTimeoutConfigType = { enabled: boolean; timeoutMs: number };

/** A simulator-emitted socket event, as the browser would receive it. */
export type SimEmittedEvent = {
  eventName: string;
  data?: Record<string, unknown>;
};

export type SimEventListener = (event: SimEmittedEvent) => void;
