import { useEffect, useRef, useState } from 'react';

const DISARM_MS = 3000;

export type ConfirmTapState = {
  /** True after the first tap — the next tap fires the action. */
  armed: boolean;
  /** Tap handler: first tap arms, second tap (while armed) fires. */
  onTap: () => void;
};

/**
 * Two-tap confirm gate for destructive controls (UX_UI_PRINCIPLES 2): the
 * first tap arms the control (caller renders a visible "confirm?" state),
 * a second tap within 3s fires the action, and the arm auto-expires so a
 * walk-away never leaves a live destructive tap behind on the kiosk.
 */
export const useConfirmTap = (action: () => void): ConfirmTapState => {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const onTap = () => {
    if (armed) {
      window.clearTimeout(timerRef.current);
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setArmed(false), DISARM_MS);
  };

  return { armed, onTap };
};
