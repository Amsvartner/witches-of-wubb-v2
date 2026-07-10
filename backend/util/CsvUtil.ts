import { ClipTypes } from '../type/ClipTypes';
import { ClipMetadataType } from '../type/ClipMetadataType';
import { ClipNameToInfoMapType } from '../type/ClipNameToInfoMapType';
import { CsvRow } from '../type/CsvRow';
import { RFIDToClipMapType } from '../type/RFIDToClipMapType';

function parseCsv(
  RFIDToClipMap: RFIDToClipMapType,
  ClipNameToInfoMap: ClipNameToInfoMapType,
  row: CsvRow,
) {
  const rfid = row['RFID'];
  const clipName = String(row['Clip Name']);
  const type = row['Clip Type (e.g. Vocals)'] as ClipTypes;
  const assetName = String(row['Icon / Asset Name']);
  const artist = String(row['Artist']);
  const songTitle = String(row['Song Title']);
  const ingredientName = String(row['Ingredient Name / Description']);
  const key = String(row['Key']);

  if (clipName?.trim() && rfid?.trim()) {
    RFIDToClipMap[rfid] = {
      clipName,
      type,
      assetName,
      artist,
      songTitle,
      ingredientName,
      key,
    };
    ClipNameToInfoMap[clipName?.replace(/[ ]/g, '')] = {
      rfid,
      type,
      assetName,
      artist,
      songTitle,
      ingredientName,
      key,
    };
  }
}

function enrichRecommendations(
  RFIDToClipMap: RFIDToClipMapType,
  ClipNameToInfoMap: ClipNameToInfoMapType,
  csv: CsvRow[],
  row: CsvRow,
) {
  const keyHeader = 'Key Numerical';
  const clipNameHeader = 'Clip Name';

  const rfid = row['RFID'];
  const clipName = String(row[clipNameHeader]);

  const recommendedClips = csv
    .filter((compRow: CsvRow) => {
      // The CSV values are strings; the original arithmetic relies on JS
      // string-to-number coercion, so the casts below are type-only.
      return (
        Math.abs(
          (compRow[keyHeader] as unknown as number) - (row[keyHeader] as unknown as number),
        ) <= 1 && compRow[clipNameHeader] !== row[clipNameHeader]
      );
    })
    .map(
      (row: CsvRow) =>
        ({
          ...RFIDToClipMap[row['RFID']],
          rfid: row['RFID'],
        } as ClipMetadataType),
    )
    .reduce((acc: Record<string, ClipMetadataType[]>, curr: ClipMetadataType) => {
      if (acc[curr.type]) {
        acc[curr.type].push(curr);
      } else {
        acc[curr.type] = [curr];
      }
      return acc;
    }, {});

  RFIDToClipMap[rfid] = {
    ...RFIDToClipMap[rfid],
    recommendedClips,
  };

  ClipNameToInfoMap[clipName?.replace(/[ ]/g, '')] = {
    ...ClipNameToInfoMap[clipName?.replace(/[ ]/g, '')],
    recommendedClips,
  };
}

export const CsvUtil = {
  parseCsv,
  enrichRecommendations,
};
