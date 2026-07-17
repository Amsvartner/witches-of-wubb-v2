import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarStatus } from '~/type/PillarStatus';
import { QueuedSample } from '~/type/QueuedSample';

/**
 * View-model for one pillar card. Static/mock only in WOW-007A — no socket
 * wiring. An absent `category` means the pillar is empty and shows no category
 * identity (no icon, name, or colour), per the visual-direction rule.
 */
export type PillarView =
  | {
      pillarNumber: number;
      status: 'empty';
      /** Absent => empty pillar (renders "awaiting ingredient", no category). */
      category?: undefined;
      /** Mute toggle state (independent of playback status). */
      muted: boolean;
      /** Display-only volume percentage (0–100). */
      volumePercent: number;
      /** Queued samples; the pillar card renders at most its row cap. */
      queued: QueuedSample[];
    }
  | {
      pillarNumber: number;
      status: Exclude<PillarStatus, 'empty'>;
      category: ClipTypes;
      /** Mute toggle state (independent of playback status). */
      muted: boolean;
      /** Display-only volume percentage (0–100). */
      volumePercent: number;
      /** Queued samples; the pillar card renders at most its row cap. */
      queued: QueuedSample[];
    };
