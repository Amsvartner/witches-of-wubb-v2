import { ClipTypes } from 'backend/type/ClipTypes';
import { CategoryTheme } from '~/util/CategoryTheme';

const CATEGORIES: ClipTypes[] = [ClipTypes.Vox, ClipTypes.Melody, ClipTypes.Bass, ClipTypes.Drums];

/**
 * Persistent sample-type legend (colour + name) — the four categories only
 * (DESIGN_PROPOSAL_001 §1). Category text uses the AA-legible `-300` tint; the
 * saturated fill is reserved for the LED-matching dot (§7.2).
 */
export const Legend = (): JSX.Element => (
  <div className='flex items-center justify-center gap-6'>
    <span className='font-data text-xs uppercase tracking-[0.3em] text-gold-line/70'>
      <span aria-hidden='true'>◈ </span>Sample Types<span aria-hidden='true'> ◈</span>
    </span>
    <ul className='flex items-center gap-6'>
      {CATEGORIES.map((type) => {
        const { label, fillHex, tintHex } = CategoryTheme.forType(type);
        return (
          <li key={type} className='flex items-center gap-2'>
            <span
              style={{ backgroundColor: fillHex, boxShadow: `0 0 8px ${fillHex}aa` }}
              className='h-3 w-3 rounded-full'
              aria-hidden='true'
            />
            <span
              style={{ color: tintHex }}
              className='font-data text-xs uppercase tracking-[0.16em]'
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);
