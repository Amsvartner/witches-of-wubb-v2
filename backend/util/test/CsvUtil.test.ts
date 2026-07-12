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

function buildRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    RFID: 'e280f3372000f00003effc41',
    'Clip Name': 'Wicked Casting',
    'Clip Type (e.g. Vocals)': ClipTypes.Vox,
    'Icon / Asset Name': 'wicked-casting.png',
    Artist: 'Test Artist',
    'Song Title': 'Test Song',
    'Ingredient Name / Description': 'Test Ingredient',
    Key: '4A',
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

describe('CsvUtil.parseCsv - ClipNameToInfoMap key normalization (WOW-031)', () => {
  it('keys ClipNameToInfoMap with all spaces stripped, matching pre-existing behavior for plain names', () => {
    const RFIDToClipMap: RFIDToClipMapType = {};
    const ClipNameToInfoMap: ClipNameToInfoMapType = {};

    CsvUtil.parseCsv(RFIDToClipMap, ClipNameToInfoMap, buildRow({ 'Clip Name': 'Wicked Casting' }));

    expect(ClipNameToInfoMap['WickedCasting']).toBeDefined();
    expect(ClipNameToInfoMap['WickedCasting'].rfid).toBe('e280f3372000f00003effc41');
  });

  it("keys ClipNameToInfoMap with asterisks also stripped - closes a latent mismatch against AbletonAdapter's own [* ] stripping at every lookup site", () => {
    const RFIDToClipMap: RFIDToClipMapType = {};
    const ClipNameToInfoMap: ClipNameToInfoMapType = {};

    CsvUtil.parseCsv(
      RFIDToClipMap,
      ClipNameToInfoMap,
      buildRow({ 'Clip Name': '*Wicked Casting*' }),
    );

    // Before this fix, CsvUtil only stripped spaces (`.replace(/[ ]/g, '')`),
    // so this row would have been keyed '*WickedCasting*' (asterisks kept) -
    // a key that AbletonAdapter.ts's own [* ]-stripping lookup sites would
    // never produce or look up, since they strip asterisks too. That
    // key mismatch (a latent bug, inert only because no CSV row today
    // actually contains an asterisk) is what this test guards against.
    expect(ClipNameToInfoMap['WickedCasting']).toBeDefined();
    expect(ClipNameToInfoMap['*WickedCasting*']).toBeUndefined();
  });

  it('collapses two differently-decorated CSV rows for what is meant to be the same clip name into a single map key', () => {
    const RFIDToClipMap: RFIDToClipMapType = {};
    const ClipNameToInfoMap: ClipNameToInfoMapType = {};

    CsvUtil.parseCsv(
      RFIDToClipMap,
      ClipNameToInfoMap,
      buildRow({ RFID: 'rfid-1', 'Clip Name': 'Wicked Casting' }),
    );
    CsvUtil.parseCsv(
      RFIDToClipMap,
      ClipNameToInfoMap,
      buildRow({ RFID: 'rfid-2', 'Clip Name': '*Wicked  Casting*' }),
    );

    expect(Object.keys(ClipNameToInfoMap)).toEqual(['WickedCasting']);
    // The second row (processed later) wins the shared key - documenting
    // actual behavior, not asserting it's the only valid choice.
    expect(ClipNameToInfoMap['WickedCasting'].rfid).toBe('rfid-2');
  });
});
