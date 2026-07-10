import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { Logger } from '../util/Logger';
import { CsvUtil } from '../util/CsvUtil';
import { CsvRow } from '../type/CsvRow';
import { ClipNameToInfoMapType } from '../type/ClipNameToInfoMapType';
import { RFIDToClipMapType } from '../type/RFIDToClipMapType';

let csv = '';
const rfidToClipMap: RFIDToClipMapType = {};
const clipNameToInfoMap: ClipNameToInfoMapType = {};

try {
  Logger.info('Trying to read RFID CSV file');
  csv = fs.readFileSync(path.join(process.cwd(), '../src/assets/', 'Music Database.csv'), 'utf-8');
  const results = Papa.parse<CsvRow>(csv, {
    header: true,
    transformHeader: (header) => header.replace(':', ''),
  });
  results.data.forEach((row) => CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, row));
  // results.data.forEach(
  //   CsvUtil.enrichRecommendations.bind(this, rfidToClipMap, clipNameToInfoMap, results.data),
  // );
  Logger.trace('RFID CSV parsed');
} catch (err) {
  Logger.error(err);
}

export const MusicDatabaseService = {
  rfidToClipMap,
  clipNameToInfoMap,
};
