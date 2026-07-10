import { CsvUtil } from 'backend/util/CsvUtil';
import { ClipNameToInfoMapType } from 'backend/type/ClipNameToInfoMapType';
import { RFIDToClipMapType } from 'backend/type/RFIDToClipMapType';
import csv from '~/assets/Music Database.csv';

const rfidToClipMap: RFIDToClipMapType = {};
const clipNameToInfoMap: ClipNameToInfoMapType = {};

csv.forEach(CsvUtil.parseCsv.bind(this, rfidToClipMap, clipNameToInfoMap));

csv.forEach(CsvUtil.enrichRecommendations.bind(this, rfidToClipMap, clipNameToInfoMap, csv));

export const ClipDatabaseUtil = {
  rfidToClipMap,
  clipNameToInfoMap,
};
