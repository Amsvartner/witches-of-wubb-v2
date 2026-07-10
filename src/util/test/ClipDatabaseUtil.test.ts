import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';

describe('ClipDatabaseUtil (real Music Database.csv, read-only)', () => {
  it('builds a non-empty RFID map with the expected metadata shape', () => {
    const rfids = Object.keys(ClipDatabaseUtil.rfidToClipMap);
    expect(rfids.length).toBeGreaterThan(0);

    const sample = ClipDatabaseUtil.rfidToClipMap[rfids[0]];
    expect(sample.clipName).toBeTruthy();
    expect(sample.type).toBeTruthy();
  });

  it('mirrors every clip into the name-keyed map', () => {
    const names = Object.keys(ClipDatabaseUtil.clipNameToInfoMap);
    expect(names.length).toBeGreaterThan(0);

    const sample = ClipDatabaseUtil.clipNameToInfoMap[names[0]];
    expect(sample.rfid).toBeTruthy();
  });
});
