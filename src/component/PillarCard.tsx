import { PillarStatus } from '~/type/PillarStatus';
import { PillarView } from '~/type/PillarView';
import { CategoryTheme } from '~/util/CategoryTheme';
import { PillarFrame } from '~/component/PillarFrame';
import { PillarMedallion } from '~/component/PillarMedallion';
import { VolumeTube } from '~/component/VolumeTube';
import { DjPillarControls } from '~/component/DjPillarControls';
import { QueuedSampleRow } from '~/component/QueuedSampleRow';
import { SectionLabel } from '~/component/SectionLabel';
import { StatusBars } from '~/component/StatusBars';

type Props = {
  pillar: PillarView;
  /** Global animations switch (Settings modal kill-switch). */
  animationsEnabled?: boolean;
  /**
   * DJ-mode extras. Absent = play mode: no queue display, no per-pillar
   * controls (human decision 2026-07-17).
   */
  dj?: {
    /** Present while a clip is playing/stopping. */
    onStop?: () => void;
    onSelectSample: () => void;
    /**
     * Mute toggle (WOW-007B; WOW-007C: available on an EMPTY pillar too —
     * the backend persists desiredVolumes per pillar, so muting ahead of a
     * clip landing there is meaningful, not just muting an audible category).
     */
    muted?: boolean;
    onToggleMute?: () => void;
    /**
     * Rows to render in the Queued section (WOW-007B pending-pick queue;
     * WOW-007C: up to 2 pending picks per pillar, and every row now gets its
     * own `onPlay` — the container composes the backend-queued row (play +
     * confirm-gated remove) followed by the pillar's pending picks (play +
     * non-confirm-gated remove). Same 2-row display cap as before, applied
     * here rather than upstream. `confirmRemove` lets the container tell the
     * two row flavours apart now that `onPlay` presence no longer does.
     */
    queueRows: {
      id: string;
      name: string;
      onPlay?: () => void;
      onRemove?: () => void;
      confirmRemove?: boolean;
    }[];
  };
  /** Live volume interaction (both modes). Absent = display-only (tests/mock). */
  onVolumePercentChange?: (percent: number) => void;
  onVolumeDragStart?: () => void;
  onVolumeDragEnd?: () => void;
  /**
   * Hides the volume tube entirely (human spec 2026-07-20): in play mode, a
   * pillar with nothing audible (status 'empty' or 'queued') has no
   * meaningful volume to show, so the card centers its remaining content
   * instead. Computed by PillarCardContainer — DJ mode and an open Help
   * overlay both force this false (tubes always show there). Absent/false =
   * render the tube as before.
   */
  hideVolume?: boolean;
};

const STATUS_LABEL: Record<PillarStatus, string> = {
  playing: 'PLAYING',
  queued: 'QUEUED',
  paused: 'PAUSED',
  empty: 'EMPTY',
};

const statusDotHex = (status: PillarStatus, tintHex: string): string => {
  switch (status) {
    case 'playing':
      return '#22c55e';
    case 'queued':
      return tintHex;
    case 'paused':
      return '#9a9080';
    case 'empty':
      return '#3a3540';
  }
};

// Muted overrides the playback status as a text cue (§3.9 muted token), so the
// state never relies on the speaker icon alone.
const MUTED_DOT_HEX = '#6b6472';

/** Max queued sample rows rendered per pillar (human direction 2026-07-15). */
const MAX_QUEUED_ROWS = 2;

// Queue-row tint for an empty pillar's pending pick (WOW-007B change 3): an
// empty pillar has no category tokens to source a tint from, but a pending
// pick there still needs a row + Play button — gold-line reads as a neutral
// "not yet a category" accent rather than borrowing an unrelated category hue.
const NEUTRAL_QUEUE_TINT_HEX = '#c9a24b';

/**
 * One pillar card — the single most-reused unit of the play-mode screen. All
 * four instances share this structure; only `category` + live state differ
 * (DESIGN_PROPOSAL_001 §5). Composes the shared frame, medallion, volume tube,
 * and status. Volume is visitor-operable in both modes; the per-pillar DJ
 * controls (stop/select-sample) and the queue display only render when `dj`
 * is supplied (WOW-007B human decision 2026-07-17: play mode has no queue
 * display, no sample names, and no per-pillar control buttons).
 */
export const PillarCard = ({
  pillar,
  animationsEnabled = true,
  dj,
  onVolumePercentChange,
  onVolumeDragStart,
  onVolumeDragEnd,
  hideVolume = false,
}: Props): JSX.Element => {
  const { category, status, muted, volumePercent } = pillar;
  const tokens = category ? CategoryTheme.forType(category) : undefined;

  const dotHex = muted ? MUTED_DOT_HEX : statusDotHex(status, tokens?.tintHex ?? '#9a9080');
  const statusLabel = muted ? 'MUTED' : STATUS_LABEL[status];
  const visibleQueueRows = dj?.queueRows.slice(0, MAX_QUEUED_ROWS) ?? [];

  // PillarMedallion's props are a discriminated union: a categorised medallion
  // requires the tint + fill trio together. Branch here so `tokens` is narrowed
  // to a real value before it is passed, rather than forwarding
  // possibly-undefined colours (the WOW-007A build break).
  //
  // An EMPTY pillar's medallion (the dashed + ring) is a DJ-only surface
  // (human direction 2026-07-20): in play mode you can't add samples manually,
  // so it renders nothing at all; in DJ mode it doubles as the Add-sample
  // button.
  const medallion =
    category && tokens ? (
      <PillarMedallion
        status={status}
        category={category}
        tintHex={tokens.tintHex}
        fillHex={tokens.fillHex}
        dimmed={status === 'paused' || muted}
        animated={animationsEnabled}
      />
    ) : dj ? (
      <PillarMedallion
        status={status}
        dimmed={status === 'paused' || muted}
        animated={animationsEnabled}
        onAddSample={dj.onSelectSample}
      />
    ) : null;

  return (
    <PillarFrame className='h-full' borderHex={tokens?.fillHex} accentHex={tokens?.tintHex}>
      <div className='flex h-full flex-col gap-2 px-4 pb-6 pt-4'>
        {/* Pillar name removed (human, 2026-07-17) — the playing sample's
            category heads the card with its status + equalizer bars beneath
            (per supplied mock); the frame colour carries pillar identity. */}
        <div className='flex items-start justify-between'>
          <div className='flex flex-col gap-1'>
            {tokens ? (
              <>
                <h2
                  style={{ color: tokens.tintHex }}
                  className='font-display text-2xl tracking-[0.14em]'
                >
                  {tokens.label}
                </h2>
                <p className='flex items-center gap-2 font-data text-[15px] tracking-wide text-parchment/60'>
                  <span
                    style={{ backgroundColor: dotHex, boxShadow: `0 0 8px ${dotHex}aa` }}
                    className='h-2.5 w-2.5 rounded-full'
                    aria-hidden='true'
                  />
                  {statusLabel}
                </p>
              </>
            ) : (
              <>
                <h2 className='font-display text-2xl tracking-[0.14em] text-parchment/50'>
                  <span aria-hidden='true'>— </span>EMPTY<span aria-hidden='true'> —</span>
                </h2>
                {/* Visitor-facing invitation only — the DJ knows what an
                    empty pillar is (human, 2026-07-21: hidden in DJ mode). */}
                {!dj && (
                  <p className='font-data text-xs uppercase tracking-[0.18em] text-gold-line/80'>
                    Awaiting ingredient
                  </p>
                )}
              </>
            )}
          </div>
          {/* DJ controls render regardless of category: an EMPTY pillar is
              exactly where the DJ needs Select-sample (the legacy debug modal
              allowed placing clips on any pillar). Stop only appears when a
              clip is actually active (onStop present). Mute/unmute is now
              passed through unconditionally too (WOW-007C human decision,
              2026-07-21): the DJ can mute an EMPTY pillar ahead of a clip
              landing there (the backend persists desiredVolumes per pillar,
              so a mute set here holds), not just a categorised one. There's
              no MUTED status label on an empty pillar (no category line to
              carry it — see the tokens-branch above), so the button's own
              pressed styling (DjPillarControls) is the only state cue there. */}
          {dj && (
            <DjPillarControls
              onStop={dj.onStop}
              onSelectSample={dj.onSelectSample}
              muted={dj.muted}
              onToggleMute={dj.onToggleMute}
            />
          )}
        </div>

        <div
          className={`flex min-h-0 flex-1 gap-3 ${hideVolume ? 'items-center justify-center' : ''}`}
        >
          {!hideVolume && (
            <VolumeTube
              volumePercent={volumePercent}
              assetSlug={tokens?.assetSlug}
              onPercentChange={onVolumePercentChange}
              onDragStart={onVolumeDragStart}
              onDragEnd={onVolumeDragEnd}
            />
          )}

          <div
            className={`flex min-w-0 flex-col gap-2 ${
              hideVolume ? 'flex-none items-center' : 'flex-1'
            }`}
          >
            <div className='flex flex-col items-center gap-4 py-1'>
              {medallion}
              {tokens && (
                <StatusBars
                  colorHex={tokens.fillHex}
                  active={status === 'playing' && !muted}
                  animated={animationsEnabled}
                />
              )}
            </div>

            {/* Queue display is a DJ-mode surface only (human decision
                2026-07-17): play mode shows no queue, no sample names. Also
                renders for an EMPTY pillar that has a pending pick (WOW-007B
                change 3 — Add-sample on an empty pillar needs somewhere to
                show the resulting hold and its Play button); an empty pillar
                with nothing pending still shows no section at all, same as
                before. */}
            {dj && (tokens || visibleQueueRows.length > 0) && (
              <div className='mt-auto flex flex-col gap-1.5'>
                <SectionLabel>Queued</SectionLabel>
                {visibleQueueRows.length > 0 ? (
                  <ul className='flex flex-col gap-1.5'>
                    {/* WOW-007C item 3: every row gets a Play button now (the
                        backend-queued row included), so `confirmRemove` can
                        no longer be inferred from `onPlay`'s presence — the
                        container passes it explicitly instead: the
                        backend-queued row stays confirm-gated (removing it
                        departs a real backend hold), the pending-pick rows
                        stay non-confirm-gated (dropping a local hold that was
                        never emitted isn't destructive). A row that omits
                        `confirmRemove` falls back to the pre-item-3 heuristic
                        (`!onPlay`) rather than QueuedSampleRow's own
                        confirm-gated default, so callers that don't compose
                        a Play action keep their prior behaviour unchanged. */}
                    {visibleQueueRows.map((row) => (
                      <QueuedSampleRow
                        key={row.id}
                        name={row.name}
                        tintHex={tokens?.tintHex ?? NEUTRAL_QUEUE_TINT_HEX}
                        onPlay={row.onPlay}
                        onRemove={row.onRemove}
                        confirmRemove={row.confirmRemove ?? !row.onPlay}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className='font-data text-[15px] text-parchment/60'>Queue empty</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PillarFrame>
  );
};
