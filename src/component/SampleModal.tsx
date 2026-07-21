import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { ClipTypes } from 'backend/type/ClipTypes';
import { CategoryTheme } from '~/util/CategoryTheme';

export type SelectableClip = {
  rfid: string;
  clipName: string;
  type: ClipTypes;
  artist?: string;
  songTitle?: string;
  bpm?: number;
  key?: string;
  instrument?: string;
};

/**
 * Where (if anywhere) a clip is currently live, per rfid — across every
 * pillar. Used only for the Pillar column's sort order (WOW-007C draft/apply
 * model — chip rendering/interaction now comes from `PillarDraft`, not this
 * map). Supplied by the container from playingClips/queuedClips/stoppingClips
 * plus every pillar's local pending picks (`PlayModeContainer`'s
 * `pendingPicks`).
 */
export type ActiveByRfid = Record<
  string,
  { pillarNumber: number; state: 'playing' | 'queued' | 'stopping' | 'pending' }
>;

/** One held slot in a pillar's draft (WOW-007C draft/apply model). */
export type PillarDraftEntry = {
  clip: SelectableClip;
  /** 'queued' = gold ("will queue on Apply"); 'play' = green ("will play on Apply"). */
  state: 'queued' | 'play';
};

/**
 * One pillar's editable draft (WOW-007C): up to 2 entries, at most one of
 * which is `'play'`. Built from reality (baseline) on modal open and Revert;
 * mutated locally by chip taps; only reconciled with the backend on Apply.
 * See `~/util/PillarDraftUtil` for the baseline/tap/diff logic.
 */
export type PillarDraft = {
  entries: PillarDraftEntry[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Full clip catalogue, already sorted by name (DebugModal parity). */
  clips: SelectableClip[];
  /** Every pillar's current draft (WOW-007C), index 0-based. */
  draft: PillarDraft[];
  /**
   * Advances the chip's tap cycle at `pillarIndex` (0-based) for `clip`:
   * outlined -> queued (gold) -> play (green) -> removed, per
   * PillarCardContainer's `handleTapChip` (`~/util/PillarDraftUtil.tapChip`).
   * Called from ANY of the 4 chips on a row, regardless of which pillar's
   * modal is currently open (WOW-007B batch queueing, preserved under the
   * WOW-007C draft model — a DJ can open one pillar's picker and assign
   * clips across all 4 pillars before Applying).
   */
  onTapChip: (pillarIndex: number, clip: SelectableClip) => void;
  /** Active/pending state for every catalogue rfid — Pillar column sort only. */
  activeByRfid: ActiveByRfid;
  /** True when `draft` differs from the live baseline — gates Apply/Revert. */
  dirty: boolean;
  /** Sends the draft's diff against reality to the backend; stays open. */
  onApply: () => void;
  /** Resets the draft back to the live baseline, discarding edits. */
  onRevert: () => void;
};

type CategoryFilter = 'All' | ClipTypes;
type SortColumn = 'name' | 'key' | 'bpm' | 'type' | 'instrument' | 'pillar';
type SortDirection = 'asc' | 'desc';

const CATEGORY_ORDER: ClipTypes[] = [
  ClipTypes.Vox,
  ClipTypes.Melody,
  ClipTypes.Bass,
  ClipTypes.Drums,
];

// Chip copy is deliberately Title Case (design direction), distinct from the
// all-caps CategoryTheme label used for the row legend / play-mode UI.
const CATEGORY_CHIP_LABEL: Record<ClipTypes, string> = {
  [ClipTypes.Vox]: 'Vocals',
  [ClipTypes.Melody]: 'Melody',
  [ClipTypes.Bass]: 'Bass',
  [ClipTypes.Drums]: 'Drums',
};

/** Type-column sort order (per ticket: Vox/Melody/Bass/Drums). */
const CATEGORY_SORT_ORDER: Record<ClipTypes, number> = {
  [ClipTypes.Vox]: 0,
  [ClipTypes.Melody]: 1,
  [ClipTypes.Bass]: 2,
  [ClipTypes.Drums]: 3,
};

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'key', label: 'Key' },
  { key: 'bpm', label: 'BPM' },
  { key: 'type', label: 'Type' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'pillar', label: 'Pillar' },
];

const DEFAULT_SORT_COLUMN: SortColumn = 'name';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

/**
 * Shared grid template so the header row and every data row line up. The
 * leading 14px column is the category dot (headers render it empty) — keeping
 * it inside the grid means the Name header aligns with the name text, not
 * with the dot. The trailing 170px column holds the 4 pillar chips; both the
 * header wrapper and the scroll list reserve a stable scrollbar gutter (see
 * below) so the scrollbar can't skew rows relative to the headers.
 */
const ROW_GRID_CLASS =
  'grid grid-cols-[14px_minmax(0,1fr)_64px_64px_96px_minmax(90px,110px)_170px] items-center gap-2';

const matchesSearch = (clip: SelectableClip, query: string): boolean => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    clip.clipName.toLowerCase().includes(needle) ||
    (clip.artist ?? '').toLowerCase().includes(needle) ||
    (clip.songTitle ?? '').toLowerCase().includes(needle)
  );
};

const matchesCategory = (clip: SelectableClip, filter: CategoryFilter): boolean =>
  filter === 'All' || clip.type === filter;

const byName = (a: SelectableClip, b: SelectableClip): number =>
  a.clipName.localeCompare(b.clipName);

/** Camelot notation ("4A", "10B") -> wheel position + quality letter. */
const parseCamelotKey = (key: string): { position: number; letter: string } => ({
  position: Number(key.match(/\d+/)?.[0] ?? 0),
  letter: (key.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase(),
});

/** Whether `clip` has a value for `column` — missing values always sort last
 * (see `sortClips`), regardless of the active direction. */
const hasColumnValue = (
  clip: SelectableClip,
  column: SortColumn,
  activeByRfid: ActiveByRfid,
): boolean => {
  switch (column) {
    case 'name':
    case 'type':
      return true;
    case 'bpm':
      return clip.bpm != null;
    case 'key':
      return Boolean(clip.key);
    case 'instrument':
      return Boolean(clip.instrument);
    case 'pillar':
      return activeByRfid[clip.rfid] != null;
  }
};

/**
 * Ascending comparator for one column. Only ever called between two clips
 * that both `hasColumnValue` for `column` — missing values are filtered out
 * to the end before this runs, so the non-null assertions below are safe.
 */
const compareByColumn = (
  a: SelectableClip,
  b: SelectableClip,
  column: SortColumn,
  activeByRfid: ActiveByRfid,
): number => {
  switch (column) {
    case 'name':
      return byName(a, b);
    case 'bpm':
      return (a.bpm as number) - (b.bpm as number);
    case 'key': {
      const keyA = parseCamelotKey(a.key as string);
      const keyB = parseCamelotKey(b.key as string);
      if (keyA.position !== keyB.position) return keyA.position - keyB.position;
      return keyA.letter.localeCompare(keyB.letter);
    }
    case 'type':
      return CATEGORY_SORT_ORDER[a.type] - CATEGORY_SORT_ORDER[b.type];
    case 'instrument':
      return (a.instrument as string).localeCompare(b.instrument as string);
    case 'pillar':
      return (
        (activeByRfid[a.rfid] as { pillarNumber: number }).pillarNumber -
        (activeByRfid[b.rfid] as { pillarNumber: number }).pillarNumber
      );
  }
};

/**
 * Applies the active column sort. Missing values (no bpm/key/instrument, or
 * not active on any pillar for the Pillar column) always sort last,
 * regardless of direction. Sorts against an already name-ordered copy first
 * so ties within a sort group stay stable by name — `Array.prototype.sort` is
 * spec-stable.
 */
const sortClips = (
  list: SelectableClip[],
  column: SortColumn,
  direction: SortDirection,
  activeByRfid: ActiveByRfid,
): SelectableClip[] => {
  const nameSorted = [...list].sort(byName);
  const present = nameSorted.filter((clip) => hasColumnValue(clip, column, activeByRfid));
  const missing = nameSorted.filter((clip) => !hasColumnValue(clip, column, activeByRfid));

  const sortedPresent = [...present].sort((a, b) => {
    const ascending = compareByColumn(a, b, column, activeByRfid);
    return direction === 'asc' ? ascending : -ascending;
  });

  return [...sortedPresent, ...missing];
};

export type DraftChipStatus = 'outlined' | 'queued' | 'play';

/**
 * Which of the 4 pillar chips a clip's row renders as, for the chip at
 * `chipPillarNumber` (1-based) — driven entirely by that pillar's `draft`
 * entry for this clip (WOW-007C draft/apply model). Chips are never disabled:
 * every playing/queued clip stays movable between pillars (human decision
 * 2026-07-20), so `outlined` covers both "not drafted anywhere" and "drafted
 * on a DIFFERENT pillar" (tapping it here is a valid move).
 */
const draftChipStatus = (
  clip: SelectableClip,
  chipPillarNumber: number,
  draft: PillarDraft[],
): DraftChipStatus => {
  const entry = draft[chipPillarNumber - 1]?.entries.find((e) => e.clip.rfid === clip.rfid);
  return entry?.state ?? 'outlined';
};

const CHIP_ARIA_LABEL: Record<DraftChipStatus, (clipName: string, pillarNumber: number) => string> =
  {
    outlined: (clipName, pillarNumber) => `Queue ${clipName} on pillar ${pillarNumber}`,
    queued: (clipName, pillarNumber) => `Set ${clipName} to play on pillar ${pillarNumber}`,
    play: (clipName, pillarNumber) => `Remove ${clipName} from pillar ${pillarNumber}`,
  };

/**
 * Dense-table exception to the installation's usual 44px hit-target rule
 * (UX_UI_PRINCIPLES §8): four chips have to fit a ~170px column without
 * wrapping, so each chip gets a considered 40px minimum instead of 44px —
 * still generously tappable on the touch panel, just narrower than the
 * standard control size.
 */
const CHIP_BASE_CLASS =
  'flex min-h-[40px] items-center justify-center rounded-md font-data text-xs uppercase tracking-[0.08em]';
const CHIP_OUTLINED_CLASS = 'border border-gold-line/50 text-parchment/70 bg-transparent';
const CHIP_PENDING_CLASS = 'bg-gold-line/80 text-ink-deep border border-transparent';
// PLAYING gets its own green fill (human request 2026-07-20) — the same hue as
// the pillar cards' playing status dot, so "green = audibly live" reads
// consistently across the whole DJ surface.
const CHIP_PLAYING_CLASS = 'bg-[#22c55e]/85 text-ink-deep border-transparent';

const CHIP_CLASS_BY_STATUS: Record<DraftChipStatus, string> = {
  outlined: CHIP_OUTLINED_CLASS,
  queued: CHIP_PENDING_CLASS,
  play: CHIP_PLAYING_CLASS,
};

/**
 * DJ-mode sample picker (WOW-007B, reworked around a draft/apply model in
 * WOW-007C) — the old debug modal's per-pillar clip list in grimoire styling.
 * Each row shows a P1..P4 chip strip; tapping an eligible chip advances that
 * pillar's DRAFT for the clip (outlined -> queued/gold -> play/green ->
 * removed) without touching the backend. Nothing queues or plays until the
 * DJ taps Apply, which diffs the draft against live reality and emits the
 * `/departed/tag` / `/new/tag` events (see PillarCardContainer's
 * `handleApply`, `~/util/PillarDraftUtil`). The modal stays open across chip
 * taps AND across Apply so a DJ can keep assigning pillars from one open
 * picker; only Close dismisses it.
 *
 * Sortable column headers (Name/Key/BPM/Type/Instrument/Pillar,
 * click-to-toggle ascending/descending); search/filter/sort state resets
 * whenever `open` transitions, so a DJ opening a different pillar's (or the
 * same pillar's, next time) picker never inherits a stale search. Rows
 * themselves are not clickable — only the pillar chips are.
 */
export const SampleModal = ({
  open,
  onClose,
  clips,
  draft,
  onTapChip,
  activeByRfid,
  dirty,
  onApply,
  onRevert,
}: Props): JSX.Element => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [sortColumn, setSortColumn] = useState<SortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  useEffect(() => {
    setSearch('');
    setCategory('All');
    setSortColumn(DEFAULT_SORT_COLUMN);
    setSortDirection(DEFAULT_SORT_DIRECTION);
  }, [open]);

  const filteredClips = useMemo(
    () => clips.filter((clip) => matchesSearch(clip, search) && matchesCategory(clip, category)),
    [clips, search, category],
  );
  const visibleClips = useMemo(
    () => sortClips(filteredClips, sortColumn, sortDirection, activeByRfid),
    [filteredClips, sortColumn, sortDirection, activeByRfid],
  );

  const resetFilters = (): void => {
    setSearch('');
    setCategory('All');
    setSortColumn(DEFAULT_SORT_COLUMN);
    setSortDirection(DEFAULT_SORT_DIRECTION);
  };

  const handleHeaderClick = (column: SortColumn): void => {
    if (column === sortColumn) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  return (
    <Dialog open={open} onClose={onClose} className='relative z-50'>
      <div className='fixed inset-0 bg-[#0b0910]/95' aria-hidden='true' />
      <div className='fixed inset-0 flex items-center justify-center p-6'>
        <Dialog.Panel className='flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
          <Dialog.Title className='font-display text-2xl tracking-[0.14em] text-gold-bright'>
            Sample selector
          </Dialog.Title>

          <div className='mt-4 flex shrink-0 flex-col gap-3'>
            <div className='flex min-h-[44px] items-center gap-2 rounded-lg border border-gold-line/40 bg-ink-inset px-3'>
              <input
                type='text'
                aria-label='Search samples'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search samples…'
                className='min-h-[44px] flex-1 bg-transparent font-data text-[15px] text-parchment/90 placeholder:text-parchment/40 focus:outline-none'
              />
              {search.length > 0 && (
                <button
                  type='button'
                  aria-label='Clear search'
                  onClick={() => setSearch('')}
                  className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-parchment/60 hover:text-parchment focus-visible:text-parchment'
                >
                  ×
                </button>
              )}
            </div>

            <div className='flex gap-2'>
              <button
                type='button'
                aria-pressed={category === 'All'}
                onClick={() => setCategory('All')}
                className={`min-h-[44px] flex-1 rounded-lg font-data text-xs uppercase tracking-[0.14em] ${
                  category === 'All'
                    ? 'bg-gold-line/70 text-ink-deep'
                    : 'bg-ink-btn text-gold-bright'
                }`}
              >
                All
              </button>
              {CATEGORY_ORDER.map((type) => {
                const tokens = CategoryTheme.forType(type);
                const isActive = category === type;
                return (
                  <button
                    key={type}
                    type='button'
                    aria-pressed={isActive}
                    onClick={() => setCategory(type)}
                    style={
                      isActive ? { backgroundColor: tokens.fillHex } : { color: tokens.tintHex }
                    }
                    className={`min-h-[44px] flex-1 rounded-lg font-data text-xs uppercase tracking-[0.14em] ${
                      isActive ? 'text-ink-deep' : 'bg-ink-btn'
                    }`}
                  >
                    {CATEGORY_CHIP_LABEL[type]}
                  </button>
                );
              })}
            </div>

            <p className='font-data text-xs text-parchment/60'>{visibleClips.length} samples</p>

            {/* overflow-y-auto + the same stable scrollbar-gutter as the list
                below: the header never scrolls, but reserving the identical
                gutter width keeps its grid exactly as wide as the rows'. */}
            <div className={`${ROW_GRID_CLASS} overflow-y-auto px-2 [scrollbar-gutter:stable]`}>
              <span aria-hidden='true' />
              {COLUMNS.map((column) => {
                const isActive = sortColumn === column.key;
                const ariaSort = isActive
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
                // Instrument's cell text is left-aligned (truncating column),
                // so its header lines up the same way Name's does.
                const isLeftAligned = column.key === 'name' || column.key === 'instrument';
                return (
                  <button
                    key={column.key}
                    type='button'
                    role='columnheader'
                    aria-sort={ariaSort}
                    onClick={() => handleHeaderClick(column.key)}
                    className={`flex min-h-[44px] items-center gap-1 font-data text-xs uppercase tracking-[0.14em] ${
                      isLeftAligned ? 'justify-start' : 'justify-center'
                    } ${isActive ? 'text-gold-bright' : 'text-parchment/60'}`}
                  >
                    {column.label}
                    {isActive && (
                      <span aria-hidden='true'>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {visibleClips.length === 0 ? (
            <div className='flex flex-1 flex-col items-center justify-center gap-3 py-10'>
              <p className='font-data text-sm text-parchment/60'>No samples match</p>
              <button
                type='button'
                onClick={resetFilters}
                className='flex min-h-[44px] items-center rounded-lg border border-gold-line/50 bg-ink-btn px-5 font-data text-sm tracking-wide text-parchment/90'
              >
                Reset filters
              </button>
            </div>
          ) : (
            <ul className='mt-1 min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]'>
              {visibleClips.map((clip) => {
                const tokens = CategoryTheme.forType(clip.type);
                return (
                  <li key={clip.rfid}>
                    <div className={`${ROW_GRID_CLASS} min-h-[44px] w-full rounded-lg px-2`}>
                      <span
                        style={{
                          backgroundColor: tokens.fillHex,
                          boxShadow: `0 0 6px ${tokens.fillHex}aa`,
                        }}
                        className='h-2.5 w-2.5 justify-self-center rounded-full'
                        aria-hidden='true'
                      />
                      <span className='truncate font-data text-[15px] text-parchment/90'>
                        {clip.clipName}
                      </span>
                      <span className='text-center font-number text-xs text-parchment/70'>
                        {clip.key ?? '—'}
                      </span>
                      <span className='text-center font-number text-xs text-parchment/70'>
                        {clip.bpm ?? '—'}
                      </span>
                      <span
                        style={{ color: tokens.tintHex }}
                        className='text-center font-data text-xs uppercase tracking-[0.1em]'
                      >
                        {tokens.label}
                      </span>
                      <span className='truncate text-left font-data text-xs text-parchment/70'>
                        {clip.instrument ?? '—'}
                      </span>
                      <div className='grid grid-cols-4 gap-1'>
                        {([1, 2, 3, 4] as const).map((chipPillarNumber) => {
                          const status = draftChipStatus(clip, chipPillarNumber, draft);
                          const chipIndex = chipPillarNumber - 1;
                          return (
                            <button
                              key={chipPillarNumber}
                              type='button'
                              aria-pressed={status !== 'outlined'}
                              aria-label={CHIP_ARIA_LABEL[status](clip.clipName, chipPillarNumber)}
                              onClick={() => onTapChip(chipIndex, clip)}
                              className={`${CHIP_BASE_CLASS} ${CHIP_CLASS_BY_STATUS[status]}`}
                            >
                              {`P${chipPillarNumber}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className='mt-4 flex shrink-0 justify-end gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex min-h-[44px] items-center rounded-lg border border-gold-line/50 bg-ink-btn px-5 font-data text-sm tracking-wide text-parchment/90'
            >
              Close
            </button>
            {/* Revert discards the draft back to the live baseline; Apply
                sends its diff to the backend. Both stay disabled until the
                draft actually differs from reality (WOW-007C) — the modal
                never stays open on a no-op tap of either. */}
            <button
              type='button'
              onClick={onRevert}
              disabled={!dirty}
              aria-label='Revert changes'
              className='flex min-h-[44px] items-center rounded-lg border border-gold-line/50 bg-ink-btn px-5 font-data text-sm tracking-wide text-parchment/90 disabled:opacity-40'
            >
              Revert
            </button>
            <button
              type='button'
              onClick={onApply}
              disabled={!dirty}
              aria-label='Apply changes'
              className='flex min-h-[44px] items-center rounded-lg bg-gold-line/70 px-5 font-data text-sm tracking-wide text-ink-deep disabled:bg-ink-btn disabled:text-parchment/50 disabled:opacity-60'
            >
              Apply
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
