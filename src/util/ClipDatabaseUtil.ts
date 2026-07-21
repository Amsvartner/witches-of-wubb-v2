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

// WOW-007B: the CSV also has an Instrument column (e.g. "Electric Guitar",
// "Drums (standard kit)"), but neither CsvUtil.parseCsv nor
// backend/type/ClipMetadataType know about it — same reasoning as the BPM
// enrichment above: the parser is shared with the live backend, and adding a
// field there would leak into contract-frozen event payloads (needs
// audio-ableton sign-off). This map is frontend-only, keyed by rfid, and
// built straight from the raw rows. Rows with no Instrument value are
// skipped entirely (no key) rather than stored as an empty string, so a
// missing instrument reads as `undefined` via plain lookup.
const rfidToInstrumentMap: Record<string, string> = {};
csv.forEach((row) => {
  const rfid = row['RFID'];
  const instrument = row['Instrument']?.trim();
  if (!rfid || !instrument) return;
  rfidToInstrumentMap[rfid] = instrument;
});

export const ClipDatabaseUtil = {
  rfidToClipMap,
  clipNameToInfoMap,
  rfidToInstrumentMap,
};
