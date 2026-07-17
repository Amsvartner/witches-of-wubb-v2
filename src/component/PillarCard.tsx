import { PillarStatus } from '~/type/PillarStatus';
import { PillarView } from '~/type/PillarView';
import { CategoryTheme } from '~/util/CategoryTheme';
import { PillarFrame } from '~/component/PillarFrame';
import { PillarMedallion } from '~/component/PillarMedallion';
import { VolumeTube } from '~/component/VolumeTube';
import { PillarControls } from '~/component/PillarControls';
import { QueuedSampleRow } from '~/component/QueuedSampleRow';
import { SectionLabel } from '~/component/SectionLabel';
import { StatusBars } from '~/component/StatusBars';

type Props = {
  pillar: PillarView;
  /** Global animations switch (Settings modal kill-switch). */
  animationsEnabled?: boolean;
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

/**
 * One pillar card — the single most-reused unit of the play-mode screen. All
 * four instances share this structure; only `category` + live state differ
 * (DESIGN_PROPOSAL_001 §5). Composes the shared frame, medallion, volume tube,
 * status, per-pillar controls, and queued sample rows.
 */
export const PillarCard = ({ pillar, animationsEnabled = true }: Props): JSX.Element => {
  const { category, status, muted, volumePercent, queued } = pillar;
  const tokens = category ? CategoryTheme.forType(category) : undefined;

  const dotHex = muted ? MUTED_DOT_HEX : statusDotHex(status, tokens?.tintHex ?? '#9a9080');
  const statusLabel = muted ? 'MUTED' : STATUS_LABEL[status];
  const visibleQueued = queued.slice(0, MAX_QUEUED_ROWS);

  // PillarMedallion's props are a discriminated union: a categorised medallion
  // requires the tint + fill trio together. Branch here so `tokens` is narrowed
  // to a real value before it is passed (an empty pillar renders the empty ring),
  // rather than forwarding possibly-undefined colours (the WOW-007A build break).
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
    ) : (
      <PillarMedallion
        status={status}
        dimmed={status === 'paused' || muted}
        animated={animationsEnabled}
      />
    );

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
                <p className='font-data text-xs uppercase tracking-[0.18em] text-gold-line/80'>
                  Awaiting ingredient
                </p>
              </>
            )}
          </div>
          {tokens && <PillarControls status={status} muted={muted} />}
        </div>

        <div className='flex min-h-0 flex-1 gap-3'>
          <VolumeTube volumePercent={volumePercent} assetSlug={tokens?.assetSlug} />

          <div className='flex min-w-0 flex-1 flex-col gap-2'>
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

            {tokens && (
              <div className='mt-auto flex flex-col gap-1.5'>
                <SectionLabel>Queued</SectionLabel>
                {visibleQueued.length > 0 ? (
                  <ul className='flex flex-col gap-1.5'>
                    {visibleQueued.map((sample) => (
                      <QueuedSampleRow
                        key={sample.id}
                        name={sample.name}
                        tintHex={tokens.tintHex}
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
