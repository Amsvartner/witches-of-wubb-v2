import { CsvUtil } from '../CsvUtil';
import { ClipTypes } from '../../type/ClipTypes';
import { CsvRow } from '../../type/CsvRow';
import { ClipNameToInfoMapType } from '../../type/ClipNameToInfoMapType';
import { RFIDToClipMapType } from '../../type/RFIDToClipMapType';

function makeRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    RFID: 'rfid-1',
    'Clip Name': 'Test Clip 5A 120',
    'Clip Type (e.g. Vocals)': ClipTypes.Melody,
    'Icon / Asset Name': 'test-icon.png',
    Artist: 'Test Artist',
    'Song Title': 'Test Song',
    'Ingredient Name / Description': 'Test Ingredient',
    Key: '5A',
    'Key Numerical': '5',
    ...overrides,
  };
}

describe('CsvUtil.parseCsv', () => {
  let rfidToClipMap: RFIDToClipMapType;
  let clipNameToInfoMap: ClipNameToInfoMapType;

  beforeEach(() => {
    rfidToClipMap = {};
    clipNameToInfoMap = {};
  });

  it('populates both maps for a valid row', () => {
    CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, makeRow());

    expect(rfidToClipMap['rfid-1']).toEqual({
      clipName: 'Test Clip 5A 120',
      type: ClipTypes.Melody,
      assetName: 'test-icon.png',
      artist: 'Test Artist',
      songTitle: 'Test Song',
      ingredientName: 'Test Ingredient',
      key: '5A',
    });
  });

  it("space-strips the clip name for clipNameToInfoMap's key, and omits clipName from the stored value (WOW-016's contract)", () => {
    CsvUtil.parseCsv(
      rfidToClipMap,
      clipNameToInfoMap,
      makeRow({ 'Clip Name': '"Doink U" Vox 122' }),
    );

    expect(clipNameToInfoMap['"DoinkU"Vox122']).toEqual({
      rfid: 'rfid-1',
      type: ClipTypes.Melody,
      assetName: 'test-icon.png',
      artist: 'Test Artist',
      songTitle: 'Test Song',
      ingredientName: 'Test Ingredient',
      key: '5A',
    });
    // The un-stripped name must not also exist as a key.
    expect(clipNameToInfoMap['"Doink U" Vox 122']).toBeUndefined();
  });

  it('skips a row with an empty clip name (neither map gets an entry)', () => {
    CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, makeRow({ 'Clip Name': '' }));

    expect(rfidToClipMap['rfid-1']).toBeUndefined();
    expect(Object.keys(clipNameToInfoMap)).toHaveLength(0);
  });

  it('skips a row with a whitespace-only clip name', () => {
    CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, makeRow({ 'Clip Name': '   ' }));

    expect(rfidToClipMap['rfid-1']).toBeUndefined();
    expect(Object.keys(clipNameToInfoMap)).toHaveLength(0);
  });

  it('skips a row with an empty rfid', () => {
    CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, makeRow({ RFID: '' }));

    expect(Object.keys(rfidToClipMap)).toHaveLength(0);
    expect(clipNameToInfoMap['TestClip5A120']).toBeUndefined();
  });

  it('skips a row with a whitespace-only rfid', () => {
    CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, makeRow({ RFID: '   ' }));

    expect(Object.keys(rfidToClipMap)).toHaveLength(0);
    expect(Object.keys(clipNameToInfoMap)).toHaveLength(0);
  });

  it('accumulates multiple valid rows without clobbering each other', () => {
    CsvUtil.parseCsv(
      rfidToClipMap,
      clipNameToInfoMap,
      makeRow({ RFID: 'rfid-1', 'Clip Name': 'Clip One' }),
    );
    CsvUtil.parseCsv(
      rfidToClipMap,
      clipNameToInfoMap,
      makeRow({ RFID: 'rfid-2', 'Clip Name': 'Clip Two' }),
    );

    expect(Object.keys(rfidToClipMap).sort()).toEqual(['rfid-1', 'rfid-2']);
    expect(Object.keys(clipNameToInfoMap).sort()).toEqual(['ClipOne', 'ClipTwo']);
  });
});

describe('CsvUtil.enrichRecommendations', () => {
  it('groups recommended clips by type, keyed to the same rfid and space-stripped clip name used by parseCsv', () => {
    const rfidToClipMap: RFIDToClipMapType = {};
    const clipNameToInfoMap: ClipNameToInfoMapType = {};

    const rows = [
      makeRow({ RFID: 'r1', 'Clip Name': 'Anchor Clip', 'Key Numerical': '5' }),
      makeRow({
        RFID: 'r2',
        'Clip Name': 'Neighbor Drums',
        'Clip Type (e.g. Vocals)': ClipTypes.Drums,
        'Key Numerical': '6', // within 1 of the anchor's 5
      }),
      makeRow({
        RFID: 'r3',
        'Clip Name': 'Neighbor Bass',
        'Clip Type (e.g. Vocals)': ClipTypes.Bass,
        'Key Numerical': '4', // within 1 of the anchor's 5
      }),
      makeRow({
        RFID: 'r4',
        'Clip Name': 'Too Far',
        'Clip Type (e.g. Vocals)': ClipTypes.Vox,
        'Key Numerical': '9', // more than 1 away - excluded
      }),
    ];
    rows.forEach((row) => CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, row));

    CsvUtil.enrichRecommendations(rfidToClipMap, clipNameToInfoMap, rows, rows[0]);

    const recommendedByRfid = rfidToClipMap['r1'].recommendedClips;
    expect(recommendedByRfid).toBeDefined();
    expect(Object.keys(recommendedByRfid as object).sort()).toEqual([
      ClipTypes.Bass,
      ClipTypes.Drums,
    ]);
    expect(recommendedByRfid?.[ClipTypes.Drums]).toHaveLength(1);
    expect(recommendedByRfid?.[ClipTypes.Drums]?.[0].rfid).toBe('r2');
    expect(recommendedByRfid?.[ClipTypes.Bass]?.[0].rfid).toBe('r3');
    expect(recommendedByRfid?.[ClipTypes.Vox]).toBeUndefined();

    // The space-stripped clipNameToInfoMap entry gets the same recommendations.
    const recommendedByName = clipNameToInfoMap['AnchorClip'].recommendedClips;
    expect(recommendedByName).toEqual(recommendedByRfid);
  });

  it('excludes a row that shares the anchor clip name, even if RFIDs differ', () => {
    const rfidToClipMap: RFIDToClipMapType = {};
    const clipNameToInfoMap: ClipNameToInfoMapType = {};

    const rows = [
      makeRow({ RFID: 'r1', 'Clip Name': 'Duplicate Name', 'Key Numerical': '5' }),
      makeRow({ RFID: 'r2', 'Clip Name': 'Duplicate Name', 'Key Numerical': '5' }),
    ];
    rows.forEach((row) => CsvUtil.parseCsv(rfidToClipMap, clipNameToInfoMap, row));

    CsvUtil.enrichRecommendations(rfidToClipMap, clipNameToInfoMap, rows, rows[0]);

    expect(rfidToClipMap['r1'].recommendedClips).toEqual({});
  });
});
