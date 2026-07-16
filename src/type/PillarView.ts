import { ClipTypes } from 'backend/type/ClipTypes';
import { QueuedSample } from '~/type/QueuedSample';

/** Playback state of a pillar in the play-mode spike (§4). */
export type PillarStatus = 'playing' | 'queued' | 'paused' | 'empty';

/** Max queued sample rows rendered per pillar (human direction 2026-07-15). */
export const MAX_QUEUED_ROWS = 2;

/**
 * View-model for one pillar card. Static/mock only in WOW-007A — no socket
 * wiring. An absent `category` means the pillar is empty and shows no category
 * identity (no icon, name, or colour), per the visual-direction rule.
 */
export type PillarView = {
  pillarNumber: number;
  /** Absent => empty pillar (renders "awaiting ingredient", no category). */
  category?: ClipTypes;
  status: PillarStatus;
  /** Mute toggle state (independent of playback status). */
  muted: boolean;
  /** Display-only volume percentage (0–100). */
  volumePercent: number;
  /** Queued samples; up to MAX_QUEUED_ROWS are rendered as rows. */
  queued: QueuedSample[];
};
