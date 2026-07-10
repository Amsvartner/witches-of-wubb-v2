import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ClipTypes, buildMusicDatabase, getPillarIPAddressFromIndex } from '../../sim/core';

const csvText = fs.readFileSync(
  path.join(process.cwd(), 'src', 'assets', 'Music Database.csv'),
  'utf-8',
);

describe('buildMusicDatabase (real Music Database.csv, read-only)', () => {
  const database = buildMusicDatabase(csvText);

  it('maps a known RFID with the same fields as backend ParseCSV', () => {
    const clip = database.rfidToClipMap['e280f3372000f00003effc95'];
    expect(clip).toEqual({
      clipName: 'Mizbiz vox 3B 86',
      type: ClipTypes.Vox,
      assetName: 'poison.png',
      artist: 'Paramore',
      songTitle: 'Misery Business',
      ingredientName: 'Poison Extremely Dangerous',
      key: '4A',
    });
    expect(database.bpmByRfid['e280f3372000f00003effc95']).toBe(86);
  });

  it('skips rows without a clip name, mirroring the backend row guard', () => {
    // "Wyvern Venom" row: RFID present but no clip assigned
    expect(database.rfidToClipMap['e280f3372000f00003effc74']).toBeUndefined();
  });

  it('does not attach recommendedClips — EnrichRecommendations is disabled in the real backend', () => {
    Object.values(database.rfidToClipMap).forEach((clip) => {
      expect(clip).not.toHaveProperty('recommendedClips');
    });
  });

  it('contains usable rows for every clip type', () => {
    Object.values(ClipTypes).forEach((type) => {
      const match = Object.values(database.rfidToClipMap).find((clip) => clip.type === type);
      expect(match, `no ${type} row in database`).toBeTruthy();
    });
  });
});

describe('getPillarIPAddressFromIndex', () => {
  it('mirrors the backend pillar IP map', () => {
    expect(getPillarIPAddressFromIndex(0)).toBe('192.168.0.101');
    expect(getPillarIPAddressFromIndex(3)).toBe('192.168.0.104');
    expect(getPillarIPAddressFromIndex(7)).toBe('');
  });
});
