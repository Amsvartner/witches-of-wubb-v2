import fs from 'fs';
import os from 'os';
import path from 'path';

describe('MusicDatabaseService (real Music Database.csv, read-only)', () => {
  const originalCwd = process.cwd();

  it('builds a non-empty RFID map regardless of caller cwd', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wubb-cwd-'));
    process.chdir(tempDir);
    try {
      const { MusicDatabaseService } = await import('../MusicDatabaseService');
      expect(Object.keys(MusicDatabaseService.rfidToClipMap).length).toBeGreaterThan(0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('mirrors every clip into the name-keyed map', async () => {
    const { MusicDatabaseService } = await import('../MusicDatabaseService');
    expect(Object.keys(MusicDatabaseService.clipNameToInfoMap).length).toBeGreaterThan(0);
  });
});
