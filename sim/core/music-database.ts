/**
 * Builds the RFID → clip-metadata map from `Music Database.csv` text, exactly
 * mirroring the real backend's pipeline (backend/utils/get-clip-from-rfid.ts
 * + backend/utils/parse-csv.ts):
 *
 * - Same column mapping and row guard as ParseCSV (backend/utils/parse-csv.ts:3).
 * - `EnrichRecommendations` is NOT applied — the real backend has it commented
 *   out (backend/utils/get-clip-from-rfid.ts:21-23), so live
 *   `ingredient_detected` payloads carry no `recommendedClips`. The simulator
 *   mirrors that.
 * - BPM is kept in a separate lookup: the real backend derives bpm from
 *   Ableton warp markers for `clip_started` payloads and never stores it on
 *   the metadata map. The CSV's BPM column is the closest offline stand-in.
 */
import { CsvRow, parseCsvText } from './csv';
import { ClipTypes, RFIDToClipMapType } from './types';

export type MusicDatabase = {
  rfidToClipMap: RFIDToClipMapType;
  bpmByRfid: Record<string, number>;
  rows: CsvRow[];
};

export function buildMusicDatabase(csvText: string): MusicDatabase {
  const rows = parseCsvText(csvText);
  const rfidToClipMap: RFIDToClipMapType = {};
  const bpmByRfid: Record<string, number> = {};

  rows.forEach((row) => {
    // Field mapping mirrors ParseCSV (backend/utils/parse-csv.ts:8-38)
    const rfid = row['RFID'];
    const clipName = String(row['Clip Name']);
    const type = row['Clip Type (e.g. Vocals)'] as ClipTypes;
    const assetName = String(row['Icon / Asset Name']);
    const artist = String(row['Artist']);
    const songTitle = String(row['Song Title']);
    const ingredientName = String(row['Ingredient Name / Description']);
    const key = String(row['Key']);

    if (clipName?.trim() && rfid?.trim()) {
      rfidToClipMap[rfid] = {
        clipName,
        type,
        assetName,
        artist,
        songTitle,
        ingredientName,
        key,
      };
      const bpm = Number(row['BPM']);
      if (!Number.isNaN(bpm) && bpm > 0) bpmByRfid[rfid] = bpm;
    }
  });

  return { rfidToClipMap, bpmByRfid, rows };
}

/**
 * Mirrors IP_ADDRESS_TO_PILLAR_INDEX_MAP and getPillarIPAddressFromIndex
 * (backend/events/incoming-events.ts:29-38): websocket tag events carry a
 * pillar index, which the real backend converts back to the pillar's IP so
 * `ingredient_detected`/`ingredient_removed` can include `requestAddress`.
 */
export const IP_ADDRESS_TO_PILLAR_INDEX_MAP: Record<string, number> = {
  '192.168.0.101': 0,
  '192.168.0.102': 1,
  '192.168.0.103': 2,
  '192.168.0.104': 3,
};

export function getPillarIPAddressFromIndex(index: number) {
  return Object.entries(IP_ADDRESS_TO_PILLAR_INDEX_MAP).find(([_, i]) => i === index)?.[0] ?? '';
}
