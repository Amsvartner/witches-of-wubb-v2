import { ClipTypes } from 'backend/type/ClipTypes';

type Props = {
  type: ClipTypes;
  /** px size of the square icon. */
  size?: number;
  className?: string;
};

/**
 * Category medallion icon set (human direction 2026-07-15):
 *   - Vocals — microphone
 *   - Melody — beamed musical notes
 *   - Bass   — hexagram (matches the primary reference's bass glyph)
 *   - Drums  — drum head / snare
 *
 * INTERIM ART: hand-built line glyphs standing in for the bespoke engraved icon
 * family (§3.11). Not approved final iconography. Stroke inherits `currentColor`
 * so the medallion sets the category tint.
 */
const strokeGroup = (children: JSX.Element): JSX.Element => (
  <g
    fill='none'
    stroke='currentColor'
    strokeWidth={2.4}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    {children}
  </g>
);

const iconPaths: Record<ClipTypes, JSX.Element> = {
  [ClipTypes.Vox]: strokeGroup(
    <>
      <rect x={18} y={7} width={12} height={22} rx={6} />
      <line x1={18.5} y1={14} x2={29.5} y2={14} />
      <line x1={18.5} y1={19} x2={29.5} y2={19} />
      <path d='M13 23a11 11 0 0 0 22 0' />
      <line x1={24} y1={34} x2={24} y2={41} />
      <line x1={18} y1={41} x2={30} y2={41} />
    </>,
  ),
  [ClipTypes.Melody]: strokeGroup(
    <>
      <line x1={21} y1={14} x2={21} y2={34} />
      <line x1={37} y1={12} x2={37} y2={31} />
      <path d='M20.4 13 L37.6 11' strokeWidth={4} />
      <ellipse
        cx={16}
        cy={35}
        rx={5}
        ry={3.7}
        fill='currentColor'
        stroke='none'
        transform='rotate(-22 16 35)'
      />
      <ellipse
        cx={32}
        cy={32}
        rx={5}
        ry={3.7}
        fill='currentColor'
        stroke='none'
        transform='rotate(-22 32 32)'
      />
    </>,
  ),
  [ClipTypes.Bass]: strokeGroup(
    <>
      <polygon points='24,7 38.6,32.5 9.4,32.5' />
      <polygon points='24,41 9.4,15.5 38.6,15.5' />
      <circle cx={24} cy={24} r={3.4} />
    </>,
  ),
  [ClipTypes.Drums]: strokeGroup(
    <>
      <circle cx={24} cy={24} r={17} />
      <circle cx={24} cy={24} r={10.5} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 24 + Math.cos(rad) * 13.5;
        const cy = 24 + Math.sin(rad) * 13.5;
        return <circle key={deg} cx={cx} cy={cy} r={1.5} fill='currentColor' stroke='none' />;
      })}
    </>,
  ),
};

export const CategoryIcon = ({ type, size = 48, className }: Props): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 48 48'
    className={className}
    aria-hidden='true'
    focusable='false'
  >
    {iconPaths[type]}
  </svg>
);
