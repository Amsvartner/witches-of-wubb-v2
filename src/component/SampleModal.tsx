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

type Props = {
  open: boolean;
  onClose: () => void;
  /** 1-based pillar number, for the title. */
  pillarNumber: number;
  /** Full clip catalogue, already sorted by name (DebugModal parity). */
  clips: SelectableClip[];
  /** Places the clip on this pillar (emits the new-tag event) and closes. */
  onPick: (rfid: string) => void;
};

type CategoryFilter = 'All' | ClipTypes;
type SortMode = 'name' | 'bpm' | 'key';

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

const SORT_OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: 'name', label: 'Name' },
  { mode: 'bpm', label: 'BPM' },
  { mode: 'key', label: 'Key' },
];

const DEFAULT_SORT_MODE: SortMode = 'name';

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

/**
 * Applies the active sort. Missing bpm/key clips always sort last. Sorts
 * against an already name-ordered copy first so ties within a sort group
 * (equal bpm, equal key, or the 'name' mode itself) stay stable by name —
 * `Array.prototype.sort` is spec-stable, so a comparator returning 0 for a
 * tie preserves that pre-existing order.
 */
const sortClips = (list: SelectableClip[], mode: SortMode): SelectableClip[] => {
  const nameSorted = [...list].sort(byName);
  if (mode === 'name') return nameSorted;

  if (mode === 'bpm') {
    return nameSorted.sort((a, b) => {
      if (a.bpm == null && b.bpm == null) return 0;
      if (a.bpm == null) return 1;
      if (b.bpm == null) return -1;
      return a.bpm - b.bpm;
    });
  }

  return nameSorted.sort((a, b) => {
    if (!a.key && !b.key) return 0;
    if (!a.key) return 1;
    if (!b.key) return -1;
    const keyA = parseCamelotKey(a.key);
    const keyB = parseCamelotKey(b.key);
    if (keyA.position !== keyB.position) return keyA.position - keyB.position;
    return keyA.letter.localeCompare(keyB.letter);
  });
};

/** Right-aligned row metadata, e.g. "128 · 4A". Omits missing fields. */
const metaLabel = (clip: SelectableClip): string =>
  [clip.bpm != null ? String(clip.bpm) : null, clip.key || null].filter(Boolean).join(' · ');

/**
 * DJ-mode sample picker (WOW-007B) — the old debug modal's per-pillar clip
 * list in grimoire styling: every catalogue clip, tap to place it on the
 * pillar (the same simulated-tag event the debug modal emitted). Placing is
 * additive, not destructive, so no confirm gate (UX_UI_PRINCIPLES 2 applies
 * to stop/remove, which live on the pillar card).
 *
 * WOW-007B search/filter/sort (DESIGN_PROPOSAL_001 §6.2, scoped): search by
 * name/artist/song title, category chips, and a Name/BPM/Key sort — still
 * single tap-to-pick, no multi-select. Search/filter/sort state resets
 * whenever `open` transitions, so a DJ opening a different pillar's (or the
 * same pillar's, next time) picker never inherits a stale search.
 */
export const SampleModal = ({ open, onClose, pillarNumber, clips, onPick }: Props): JSX.Element => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_SORT_MODE);

  useEffect(() => {
    setSearch('');
    setCategory('All');
    setSortMode(DEFAULT_SORT_MODE);
  }, [open]);

  const filteredClips = useMemo(
    () => clips.filter((clip) => matchesSearch(clip, search) && matchesCategory(clip, category)),
    [clips, search, category],
  );
  const visibleClips = useMemo(() => sortClips(filteredClips, sortMode), [filteredClips, sortMode]);

  const resetFilters = (): void => {
    setSearch('');
    setCategory('All');
    setSortMode(DEFAULT_SORT_MODE);
  };

  return (
    <Dialog open={open} onClose={onClose} className='relative z-50'>
      <div className='fixed inset-0 bg-[#0b0910]/95' aria-hidden='true' />
      <div className='fixed inset-0 flex items-center justify-center p-6'>
        <Dialog.Panel className='flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-gold-line/40 bg-ink-panel p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]'>
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

            <div className='flex items-center justify-between gap-3'>
              <span className='font-data text-xs uppercase tracking-[0.14em] text-parchment/60'>
                Sort
              </span>
              <div className='flex overflow-hidden rounded-lg border border-gold-line/40'>
                {SORT_OPTIONS.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type='button'
                    aria-pressed={sortMode === mode}
                    onClick={() => setSortMode(mode)}
                    className={`min-h-[44px] min-w-[44px] px-4 font-data text-xs tracking-wide ${
                      sortMode === mode
                        ? 'bg-gold-line/70 text-ink-deep'
                        : 'bg-ink-btn text-parchment/90'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className='font-data text-xs text-parchment/60'>{visibleClips.length} samples</p>
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
            <ul className='mt-1 min-h-0 flex-1 overflow-y-auto pr-1'>
              {visibleClips.map((clip) => {
                const tokens = CategoryTheme.forType(clip.type);
                const meta = metaLabel(clip);
                return (
                  <li key={clip.rfid}>
                    <button
                      type='button'
                      onClick={() => onPick(clip.rfid)}
                      className='flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-ink-btn focus-visible:bg-ink-btn'
                    >
                      <span
                        style={{
                          backgroundColor: tokens.fillHex,
                          boxShadow: `0 0 6px ${tokens.fillHex}aa`,
                        }}
                        className='h-2.5 w-2.5 shrink-0 rounded-full'
                        aria-hidden='true'
                      />
                      <span className='flex-1 truncate font-data text-[15px] text-parchment/90'>
                        {clip.clipName}
                      </span>
                      <span className='flex flex-col items-end gap-0.5'>
                        {meta && (
                          <span className='font-number text-xs text-parchment/60'>{meta}</span>
                        )}
                        <span
                          style={{ color: tokens.tintHex }}
                          className='font-data text-xs uppercase tracking-[0.14em]'
                        >
                          {tokens.label}
                        </span>
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
