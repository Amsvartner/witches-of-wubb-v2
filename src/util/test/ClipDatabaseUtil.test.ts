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

  it('enriches the RFID map with numeric BPM from the CSV BPM column (WOW-007B)', () => {
    // CsvUtil.parseCsv never maps BPM (backend parser is contract-frozen);
    // ClipDatabaseUtil enriches its own entries from the raw rows instead.
    const entries = Object.values(ClipDatabaseUtil.rfidToClipMap);
    const withBpm = entries.filter((entry) => typeof entry.bpm === 'number');

    // The real CSV carries BPM for the overwhelming majority of rows — if the
    // enrichment regresses, this collapses to zero.
    expect(withBpm.length).toBeGreaterThan(entries.length / 2);
    withBpm.forEach((entry) => {
      expect(entry.bpm).toBeGreaterThan(0);
      expect(Number.isFinite(entry.bpm)).toBe(true);
    });

    // Spot-check a known row: "Mizbiz vox 3B 86" is BPM 86 in the CSV.
    const mizbiz = entries.find((entry) => entry.clipName === 'Mizbiz vox 3B 86');
    expect(mizbiz?.bpm).toBe(86);
  });

  it('builds a non-empty rfid-to-instrument map from the CSV Instrument column (WOW-007B)', () => {
    const instruments = Object.entries(ClipDatabaseUtil.rfidToInstrumentMap);
    expect(instruments.length).toBeGreaterThan(0);
    instruments.forEach(([rfid, instrument]) => {
      expect(rfid).toBeTruthy();
      expect(instrument.trim()).toBe(instrument);
      expect(instrument.length).toBeGreaterThan(0);
    });

    // Spot-check a known row: "Mizbiz vox 3B 86" (rfid
    // e280f3372000f00003effc95) has Instrument "Vox" in the CSV.
    expect(ClipDatabaseUtil.rfidToInstrumentMap['e280f3372000f00003effc95']).toBe('Vox');
  });
});
