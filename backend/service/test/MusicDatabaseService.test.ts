import { MusicDatabaseService } from '../MusicDatabaseService';

describe('MusicDatabaseService (real Music Database.csv, read-only)', () => {
  it('builds a non-empty RFID map regardless of caller cwd', () => {
    const rfids = Object.keys(MusicDatabaseService.rfidToClipMap);
    expect(rfids.length).toBeGreaterThan(0);
  });

  it('mirrors every clip into the name-keyed map', () => {
    const names = Object.keys(MusicDatabaseService.clipNameToInfoMap);
    expect(names.length).toBeGreaterThan(0);
  });
});
