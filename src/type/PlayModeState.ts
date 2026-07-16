import { PillarView } from '~/type/PillarView';

/**
 * Full view-model for the play-mode screen (WOW-007A spike). Static/mock only.
 * Mirrors the global musical state shown in the settings band + the four pillars.
 */
export type PlayModeState = {
  pillars: PillarView[];
  tempoBpm: number;
  tempoMin: number;
  tempoMax: number;
  autoAdjustKey: boolean;
  /** Tonic, e.g. "Db". */
  currentKey: string;
  /** Mode/quality, e.g. "MAJOR". */
  keyQuality: string;
  /** Transpose amount from source key, e.g. "+7A". */
  keyDifference: string;
};
