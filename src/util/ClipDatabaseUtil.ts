import ParseCSV, { EnrichRecommendations } from 'backend/utils/parse-csv';
import { ClipNameToInfoMapType, RFIDToClipMapType } from 'backend/types';
import csv from '~/assets/Music Database.csv';

const rfidToClipMap: RFIDToClipMapType = {};
const clipNameToInfoMap: ClipNameToInfoMapType = {};

csv.forEach(ParseCSV.bind(this, rfidToClipMap, clipNameToInfoMap));

csv.forEach(EnrichRecommendations.bind(this, rfidToClipMap, clipNameToInfoMap, csv));

export const ClipDatabaseUtil = {
  rfidToClipMap,
  clipNameToInfoMap,
};
