import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarView } from '~/type/PillarView';
import { PlayModeState } from '~/type/PlayModeState';

/**
 * Static mock state for the play-mode visual-fidelity spike (WOW-007A).
 *
 * Values are illustrative only — no socket wiring. The four pillars mirror the
 * primary reference (`hexology-grimoire-concept-3.png`): all four categories
 * present with representative playing/queued states. Empty pillars are exercised
 * in the PillarCard unit test rather than shown in the hero screen.
 */
const createPillars = (): PillarView[] => [
  {
    pillarNumber: 1,
    category: ClipTypes.Vox,
    status: 'playing',
    muted: false,
    volumePercent: 82,
    queued: [
      { id: 'v1', name: 'Vocal Hook 07' },
      { id: 'v2', name: 'Vocal Chop 14' },
    ],
  },
  {
    pillarNumber: 2,
    category: ClipTypes.Melody,
    status: 'queued',
    muted: false,
    volumePercent: 67,
    queued: [{ id: 'm1', name: 'Bright Arp 03' }],
  },
  {
    pillarNumber: 3,
    category: ClipTypes.Bass,
    status: 'playing',
    muted: true,
    volumePercent: 74,
    queued: [
      { id: 'b1', name: 'Sub Rumble 02' },
      { id: 'b2', name: '808 Glide 05' },
    ],
  },
  {
    pillarNumber: 4,
    category: ClipTypes.Drums,
    status: 'playing',
    muted: false,
    volumePercent: 55,
    queued: [],
  },
];

const create = (): PlayModeState => ({
  pillars: createPillars(),
  tempoBpm: 130,
  tempoMin: 75,
  tempoMax: 155,
  autoAdjustKey: true,
  currentKey: 'Db',
  keyQuality: 'MAJOR',
  keyDifference: '+7A',
});

export const PlayModeStateMock = {
  create,
};
