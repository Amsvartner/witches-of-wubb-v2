import csv from '~/assets/Music Database.csv';
import { KeyTranspositionService } from 'backend/service/KeyTranspositionService';
import { ClipTypes } from 'backend/type/ClipTypes';
import { CsvRow } from 'backend/type/CsvRow';
import fs from 'fs';
import path from 'path';

const rows = csv as CsvRow[];

// Mirrors CsvUtil.parseCsv's own row guard (backend/util/CsvUtil.ts): a row
// only enters rfidToClipMap / clipNameToInfoMap once both fields are
// non-blank, so these integrity checks only need to hold among the rows that
// actually participate in those maps - a reserved RFID with no clip assigned
// yet is not an error.
const validRows = rows.filter((row) => row['RFID']?.trim() && row['Clip Name']?.trim());

function stripSpaces(name: string): string {
  return name.replace(/[ ]/g, '');
}

describe('Music Database.csv data integrity (real CSV, read-only)', () => {
  it('loads a non-trivial number of rows', () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  it('has a unique RFID per row', () => {
    const byRfid = new Map<string, string[]>();
    validRows.forEach((row) => {
      const clipNames = byRfid.get(row.RFID) ?? [];
      clipNames.push(row['Clip Name']);
      byRfid.set(row.RFID, clipNames);
    });
    const duplicates = [...byRfid.entries()].filter(([, clipNames]) => clipNames.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("has a unique space-stripped clip name per row - the key clipNameToInfoMap is built from, so a collision silently overwrites the first row's metadata", () => {
    const byStrippedName = new Map<string, string[]>();
    validRows.forEach((row) => {
      const key = stripSpaces(row['Clip Name']);
      const rfids = byStrippedName.get(key) ?? [];
      rfids.push(row.RFID);
      byStrippedName.set(key, rfids);
    });
    const duplicates = [...byStrippedName.entries()].filter(([, rfids]) => rfids.length > 1);
    if (duplicates.length > 0) {
      throw new Error(
        `Duplicate space-stripped Clip Name keys: ${JSON.stringify(duplicates, null, 2)}`,
      );
    }
  });

  it('has a Key present in KeyTranspositionService.TRANSPOSITIONS whenever Key is non-empty (empty allowed for keyless clips)', () => {
    const invalid = validRows
      .filter((row) => row.Key?.trim())
      .filter((row) => !Object.hasOwn(KeyTranspositionService.TRANSPOSITIONS, row.Key))
      .map((row) => ({ clipName: row['Clip Name'], key: row.Key }));
    expect(invalid).toEqual([]);
  });

  it('has a Clip Type present in the ClipTypes enum', () => {
    const validTypes = new Set<string>(Object.values(ClipTypes));
    const invalid = validRows
      .filter((row) => row['Clip Type (e.g. Vocals)']?.trim())
      .filter((row) => !validTypes.has(row['Clip Type (e.g. Vocals)']))
      .map((row) => ({ clipName: row['Clip Name'], type: row['Clip Type (e.g. Vocals)'] }));
    expect(invalid).toEqual([]);
  });

  it('has an Icon / Asset Name that exists under public/ingredients/ whenever set', () => {
    const ingredientsDir = path.join(process.cwd(), 'public', 'ingredients');
    const missing = validRows
      .filter((row) => row['Icon / Asset Name']?.trim())
      .filter((row) => !fs.existsSync(path.join(ingredientsDir, row['Icon / Asset Name'])))
      .map((row) => ({ clipName: row['Clip Name'], icon: row['Icon / Asset Name'] }));
    expect(missing).toEqual([]);
  });
});
