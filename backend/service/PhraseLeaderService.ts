import { AbletonAdapter } from '../adapter/AbletonAdapter';
import { ClipInfo } from '../type/ClipInfo';
import { ClipList } from '../type/ClipList';

function findNextPhraseLeader(playingClips: ClipList) {
  const clipCopy = playingClips.slice().filter((clip) => clip) as ClipInfo[];
  clipCopy.sort((a, b) => {
    return (
      AbletonAdapter.TRIGGER_ORDER.indexOf(a.type) - AbletonAdapter.TRIGGER_ORDER.indexOf(b.type)
    );
  });
  return clipCopy[0];
}

export const PhraseLeaderService = {
  findNextPhraseLeader,
};
