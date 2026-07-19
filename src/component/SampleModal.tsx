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
};

/**
 * Where (if anywhere) a clip is currently live, per rfid — across every
 * pillar (WOW-007B pending-pick queue). Drives both the disabled state and
 * the Pillar column's hint text. Supplied by the container from
 * playingClips/queuedClips/stoppingClips plus every pillar's local pending
 * pick (`PlayModeContainer`'s `pendingPicks`).
 */
export type ActiveByRfid = Record<
  string,
  { pillarNumber: number; state: 'playing' | 'queued' | 'stopping' | 'pending' }
>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 1-based pillar number, for the title and the pending-on-this-pillar
   * enabled exception. */
  pillarNumber: number;
  /** Full clip catalogue, already sorted by name (DebugModal parity). */
  clips: SelectableClip[];
  /**
   * Holds the clip as this pillar's pending pick and closes the modal
   * (WOW-007B — no longer emits `/new/tag` directly; Play on the pending
   * queue row is what actually emits it, see PillarCardContainer).
   */
  onPick: (clip: SelectableClip) => void;
  /** Active/pending state for every catalogue rfid, across all 4 pillars. */
  activeByRfid: ActiveByRfid;
};

type CategoryFilter = 'All' | ClipTypes;
type SortColumn = 'name' | 'key' | 'bpm' | 'type' | 'pillar';
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
  { key: 'pillar', label: 'Pillar' },
];

const DEFAULT_SORT_COLUMN: SortColumn = 'name';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

/**
 * Shared grid template so the header row and every data row line up. The
 * leading 14px column is the category dot (headers render it empty) — keeping
 * it inside the grid means the Name header aligns with the name text, not
 * with the dot. Both the header wrapper and the scroll list reserve a stable
 * scrollbar gutter (see below) so the scrollbar can't skew rows relative to
 * the headers.
 */
const ROW_GRID_CLASS = 'grid grid-cols-[14px_minmax(0,1fr)_64px_64px_96px_80px] items-center gap-2';

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
    case 'pillar':
      return (
        (activeByRfid[a.rfid] as { pillarNumber: number }).pillarNumber -
        (activeByRfid[b.rfid] as { pillarNumber: number }).pillarNumber
      );
  }
};

/**
 * Applies the active column sort. Missing values (no bpm/key, or not active
 * on any pillar for the Pillar column) always sort last, regardless of
 * direction. Sorts against an already name-ordered copy first so ties within
 * a sort group stay stable by name — `Array.prototype.sort` is spec-stable.
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

/** `P{n}`, with a short state hint for anything but 'playing'; `—` when the
 * clip isn't active anywhere. */
const pillarCellText = (clip: SelectableClip, activeByRfid: ActiveByRfid): string => {
  const active = activeByRfid[clip.rfid];
  if (!active) return '—';
  const base = `P${active.pillarNumber}`;
  switch (active.state) {
    case 'playing':
      return base;
    case 'queued':
      return `${base} ·q`;
    case 'stopping':
      return `${base} ·s`;
    case 'pending':
      return `${base} ·hold`;
  }
};

/**
 * A tag can only ever be on one pillar, and re-picking an active clip has
 * undefined backend behaviour, so every active row is disabled — except a
 * clip that's pending ON THIS SAME pillar (re-picking it is a harmless
 * replace-with-itself).
 */
const isRowDisabled = (
  clip: SelectableClip,
  activeByRfid: ActiveByRfid,
  pillarNumber: number,
): boolean => {
  const active = activeByRfid[clip.rfid];
  if (!active) return false;
  return !(active.state === 'pending' && active.pillarNumber === pillarNumber);
};

/**
 * DJ-mode sample picker (WOW-007B) — the old debug modal's per-pillar clip
 * list in grimoire styling: tap a clip to hold it as this pillar's pending
 * pick (an explicit Play on the pillar card's queue row is what actually
 * emits the tag event — see PillarCardContainer). Holding is additive/
 * reversible, not destructive, so no confirm gate (UX_UI_PRINCIPLES 2
 * applies to stop/remove, which live on the pillar card).
 *
 * WOW-007B rework: sortable column headers (Name/Key/BPM/Type/Pillar,
 * click-to-toggle ascending/descending) replace the old segmented Name/BPM/
 * Key control; rows show every column and disable clips already active on
 * any pillar. Search/filter/sort state resets whenever `open` transitions, so
 * a DJ opening a different pillar's (or the same pillar's, next time) picker
 * never inherits a stale search.
 */
export const SampleModal = ({
  open,
  onClose,
  pillarNumber,
  clips,
  onPick,
  activeByRfid,
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
        <Dialog.Panel className='flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
          <Dialog.Title className='font-display text-2xl tracking-[0.14em] text-gold-bright'>
            Pillar {pillarNumber} — Select sample
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
                return (
                  <button
                    key={column.key}
                    type='button'
                    role='columnheader'
                    aria-sort={ariaSort}
                    onClick={() => handleHeaderClick(column.key)}
                    className={`flex min-h-[44px] items-center gap-1 font-data text-xs uppercase tracking-[0.14em] ${
                      column.key === 'name' ? 'justify-start' : 'justify-center'
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
                const disabled = isRowDisabled(clip, activeByRfid, pillarNumber);
                const pillarText = pillarCellText(clip, activeByRfid);
                return (
                  <li key={clip.rfid}>
                    <button
                      type='button'
                      disabled={disabled}
                      onClick={() => onPick(clip)}
                      className={`${ROW_GRID_CLASS} min-h-[44px] w-full rounded-lg px-2 text-left hover:bg-ink-btn focus-visible:bg-ink-btn disabled:opacity-60 disabled:hover:bg-transparent`}
                    >
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
                        className='text-center font-data text-[11px] uppercase tracking-[0.1em]'
                      >
                        {tokens.label}
                      </span>
                      <span className='text-center font-data text-xs text-parchment/70'>
                        {pillarText}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className='mt-4 flex shrink-0 justify-end'>
            <button
              type='button'
              onClick={onClose}
              className='flex min-h-[44px] items-center rounded-lg border border-gold-line/50 bg-ink-btn px-5 font-data text-sm tracking-wide text-parchment/90'
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
