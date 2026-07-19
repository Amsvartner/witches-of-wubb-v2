import { CsvUtil } from 'backend/util/CsvUtil';
import { ClipNameToInfoMapType } from 'backend/type/ClipNameToInfoMapType';
import { RFIDToClipMapType } from 'backend/type/RFIDToClipMapType';
import csv from '~/assets/Music Database.csv';

const rfidToClipMap: RFIDToClipMapType = {};
const clipNameToInfoMap: ClipNameToInfoMapType = {};

csv.forEach(CsvUtil.parseCsv.bind(this, rfidToClipMap, clipNameToInfoMap));

csv.forEach(CsvUtil.enrichRecommendations.bind(this, rfidToClipMap, clipNameToInfoMap, csv));

// WOW-007B: the CSV has a BPM column, but CsvUtil.parseCsv never maps it into
// the entries (`ClipMetadataType.bpm` stays undefined). The parser is shared
// with the live backend, where adding a field would leak into spread event
// payloads (contract-frozen; needs audio-ableton sign-off) — so the frontend
// enriches its OWN map instances here instead. Guarded: rows without a
// positive numeric BPM stay bpm-less rather than getting NaN/0.
csv.forEach((row) => {
  const bpm = Number(row['BPM']);
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  const entry = rfidToClipMap[row['RFID']];
  if (entry) {
    entry.bpm = bpm;
  }
});

export const ClipDatabaseUtil = {
  rfidToClipMap,
  clipNameToInfoMap,
};
