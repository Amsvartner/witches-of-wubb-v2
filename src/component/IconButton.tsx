import { type CSSProperties, type ReactNode } from 'react';

type Props = {
  /** Accessible label (the button shows an icon, not always text). */
  label: string;
  children: ReactNode;
  /** Optional visible text beside the icon. */
  text?: string;
  className?: string;
  style?: CSSProperties;
  /**
   * Renders a real disabled button (no focus, no activation). The WOW-007A
   * spike is display-only, so these controls are disabled until their handlers
   * are wired in a follow-up ticket — an enabled no-op would mislead keyboard
   * and screen-reader users.
   */
  disabled?: boolean;
};

/**
 * Small presentational icon button used by the per-pillar controls and queued
 * rows. Static/display only in the WOW-007A spike (no handlers wired).
 */
export const IconButton = ({
  label,
  children,
  text,
  className,
  style,
  disabled,
}: Props): JSX.Element => (
  <button
    type='button'
    aria-label={label}
    disabled={disabled}
    style={style}
    className={`flex items-center justify-center gap-1.5 rounded-lg border border-gold-line/40 bg-ink-btn text-parchment/85 disabled:cursor-default disabled:opacity-75 ${
      className ?? ''
    }`}
  >
    {children}
    {text ? <span className='font-data text-xs tracking-wide'>{text}</span> : null}
  </button>
);
