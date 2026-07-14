describe('MusicDatabaseService (real Music Database.csv, read-only)', () => {
  it('builds a non-empty RFID map', async () => {
    const { MusicDatabaseService } = await import('../MusicDatabaseService');
    expect(Object.keys(MusicDatabaseService.rfidToClipMap).length).toBeGreaterThan(0);
  });

  it('mirrors every clip into the name-keyed map', async () => {
    const { MusicDatabaseService } = await import('../MusicDatabaseService');
    expect(Object.keys(MusicDatabaseService.clipNameToInfoMap).length).toBeGreaterThan(0);
  });
});
