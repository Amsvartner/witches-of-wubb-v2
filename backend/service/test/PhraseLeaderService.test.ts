import { AbletonAdapter } from '../../adapter/AbletonAdapter';
import { PhraseLeaderService } from '../PhraseLeaderService';
import { ClipInfo } from '../../type/ClipInfo';
import { ClipList } from '../../type/ClipList';

// AbletonAdapter.TRIGGER_ORDER is imported directly (not hardcoded as
// [Drums, Melody, Bass, Vox]) so this test verifies the actual documented
// contract - "first entry in TRIGGER_ORDER wins" - rather than today's specific
// values, and stays correct if TRIGGER_ORDER is ever reordered.
const [first, second, third, fourth] = AbletonAdapter.TRIGGER_ORDER;

function fakeClip(type: ClipInfo['type'], pillar: number): ClipInfo {
  return {
    clip: {} as ClipInfo['clip'],
    pillar,
    rfid: `rfid-${pillar}`,
    clipName: `clip-${pillar}`,
    type,
    assetName: 'asset.png',
  } as ClipInfo;
}

describe('PhraseLeaderService.findNextPhraseLeader', () => {
  it('returns undefined for an all-null playing-clips list (no phrase leader yet)', () => {
    const playingClips: ClipList = [null, null, null, null];
    expect(PhraseLeaderService.findNextPhraseLeader(playingClips)).toBeUndefined();
  });

  it("promotes the clip matching TRIGGER_ORDER's first entry over every other type", () => {
    const leader = fakeClip(first, 3);
    const playingClips: ClipList = [
      fakeClip(fourth, 0),
      fakeClip(third, 1),
      fakeClip(second, 2),
      leader,
    ];
    expect(PhraseLeaderService.findNextPhraseLeader(playingClips)).toBe(leader);
  });

  it('falls back to the next TRIGGER_ORDER entry when the higher-priority type is absent', () => {
    const leader = fakeClip(second, 0);
    const playingClips: ClipList = [leader, fakeClip(third, 1), fakeClip(fourth, 2), null];
    expect(PhraseLeaderService.findNextPhraseLeader(playingClips)).toBe(leader);
  });

  it('falls all the way through to the last TRIGGER_ORDER entry when nothing higher-priority is playing', () => {
    const leader = fakeClip(fourth, 2);
    const playingClips: ClipList = [null, null, leader, null];
    expect(PhraseLeaderService.findNextPhraseLeader(playingClips)).toBe(leader);
  });

  it('ignores null slots entirely when choosing among multiple candidates', () => {
    const leader = fakeClip(third, 1);
    const playingClips: ClipList = [null, leader, null, fakeClip(fourth, 3)];
    expect(PhraseLeaderService.findNextPhraseLeader(playingClips)).toBe(leader);
  });

  it('does not mutate the input array (defensive copy before sort)', () => {
    const a = fakeClip(fourth, 0);
    const b = fakeClip(first, 1);
    const playingClips: ClipList = [a, b, null, null];
    const original = [...playingClips];

    PhraseLeaderService.findNextPhraseLeader(playingClips);

    expect(playingClips).toEqual(original);
  });
});
