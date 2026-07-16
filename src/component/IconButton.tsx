import { type CSSProperties, type ReactNode } from 'react';

type Props = {
  /** Accessible label (the button shows an icon, not always text). */
  label: string;
  children: ReactNode;
  /** Optional visible text beside the icon. */
  text?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Small presentational icon button used by the per-pillar controls and queued
 * rows. Static/display only in the WOW-007A spike (no handlers wired).
 */
export const IconButton = ({ label, children, text, className, style }: Props): JSX.Element => (
  <button
    type='button'
    aria-label={label}
    style={style}
    className={`flex items-center justify-center gap-1.5 rounded-lg border border-gold-line/40 bg-ink-btn text-parchment/85 ${
      className ?? ''
    }`}
  >
    {children}
    {text ? <span className='font-data text-xs tracking-wide'>{text}</span> : null}
  </button>
);
