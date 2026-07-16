import { MAX_QUEUED_ROWS, PillarStatus, PillarView } from '~/type/PillarView';
import { CategoryTheme } from '~/util/CategoryTheme';
import { PillarFrame } from '~/component/PillarFrame';
import { PillarMedallion } from '~/component/PillarMedallion';
import { VolumeTube } from '~/component/VolumeTube';
import { PillarControls } from '~/component/PillarControls';
import { QueuedSampleRow } from '~/component/QueuedSampleRow';
import { SectionLabel } from '~/component/SectionLabel';

type Props = {
  pillar: PillarView;
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

/**
 * One pillar card — the single most-reused unit of the play-mode screen. All
 * four instances share this structure; only `category` + live state differ
 * (DESIGN_PROPOSAL_001 §5). Composes the shared frame, medallion, volume tube,
 * status, per-pillar controls, and queued sample rows.
 */
export const PillarCard = ({ pillar }: Props): JSX.Element => {
  const { pillarNumber, category, status, muted, volumePercent, queued } = pillar;
  const tokens = category ? CategoryTheme.forType(category) : undefined;

  const headerStyle = tokens ? { color: tokens.tintHex } : undefined;
  const dotHex = muted ? MUTED_DOT_HEX : statusDotHex(status, tokens?.tintHex ?? '#9a9080');
  const statusLabel = muted ? 'MUTED' : STATUS_LABEL[status];
  const visibleQueued = queued.slice(0, MAX_QUEUED_ROWS);

  return (
    <PillarFrame className='h-full'>
      <div className='flex h-full flex-col gap-2 px-4 pb-6 pt-4'>
        <div className='flex items-center justify-between'>
          <h2
            style={headerStyle}
            className={`font-display text-2xl tracking-[0.12em] ${
              tokens ? '' : 'text-parchment/50'
            }`}
          >
            PILLAR {pillarNumber}
          </h2>
          {tokens && <PillarControls status={status} muted={muted} />}
        </div>

        <div className='flex min-h-0 flex-1 gap-3'>
          <VolumeTube volumePercent={volumePercent} assetSlug={tokens?.assetSlug} />

          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <div className='flex flex-col items-center gap-2 py-1'>
              <PillarMedallion
                status={status}
                category={category}
                tintHex={tokens?.tintHex}
                fillHex={tokens?.fillHex}
                dimmed={status === 'paused' || muted}
              />
              {tokens ? (
                <p
                  style={{ color: tokens.tintHex }}
                  className='font-display text-2xl tracking-[0.14em]'
                >
                  {tokens.label}
                </p>
              ) : (
                <p className='font-data text-[15px] uppercase tracking-[0.14em] text-parchment/60'>
                  awaiting ingredient
                </p>
              )}
            </div>

            <div className='flex items-center gap-2 rounded-md border border-gold-line/20 bg-ink-deep/70 px-3 py-2'>
              <span
                style={{ backgroundColor: dotHex, boxShadow: `0 0 8px ${dotHex}aa` }}
                className='h-2.5 w-2.5 rounded-full'
                aria-hidden='true'
              />
              <span className='font-data text-[15px] tracking-wide text-parchment/90'>
                {statusLabel}
              </span>
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
