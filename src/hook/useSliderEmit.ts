import { useEffect, useMemo, useRef, useState } from 'react';
import { throttle } from '~/util/throttle';

const EMIT_THROTTLE_MS = 100;

export type SliderEmitState = {
  /** Drag-local display value — render this, not the context value. */
  value: number;
  /** Update the local value and emit (throttled). */
  onValue: (value: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

/**
 * Shared drag-local slider state + throttled emission, extracted from the
 * legacy TempoSliderContainer/VolumeSliderContainer pattern (WOW-027) so the
 * play-mode controls reuse the exact reviewed behaviour:
 *
 * - Emissions are throttled (100ms) so a drag can't flood the socket.
 * - The displayed value tracks the drag locally for instant feedback — the
 *   context value only updates when the backend acks/re-broadcasts, and
 *   sync'ing from it mid-drag would let a stale leading-edge echo snap the
 *   display backward before the trailing emission's echo catches up.
 * - window-level pointerup/pointercancel clear the dragging flag even when
 *   the drag ends off-element (OS focus loss mid-drag).
 */
export const useSliderEmit = (
  contextValue: number,
  emit: (value: number) => void,
): SliderEmitState => {
  const [value, setValue] = useState(contextValue);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setValue(contextValue);
  }, [contextValue]);

  useEffect(() => {
    function clearDragging() {
      isDraggingRef.current = false;
    }
    window.addEventListener('pointerup', clearDragging);
    window.addEventListener('pointercancel', clearDragging);
    return () => {
      window.removeEventListener('pointerup', clearDragging);
      window.removeEventListener('pointercancel', clearDragging);
    };
  }, []);

  const throttledEmit = useMemo(() => throttle(emit, EMIT_THROTTLE_MS), [emit]);

  // A trailing throttled call can still be pending when the component
  // unmounts; cancel it so no stale tempo/volume emission fires afterwards
  // (Copilot review, PR #55). `emit` is referentially stable per this hook's
  // contract, so this cleanup only runs at unmount in practice.
  useEffect(() => () => throttledEmit.cancel(), [throttledEmit]);

  return useMemo(
    () => ({
      value,
      onValue: (next: number) => {
        setValue(next);
        throttledEmit(next);
      },
      onDragStart: () => {
        isDraggingRef.current = true;
      },
      onDragEnd: () => {
        isDraggingRef.current = false;
      },
    }),
    [value, throttledEmit],
  );
};
