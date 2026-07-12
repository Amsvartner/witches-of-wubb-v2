import { useEffect, useMemo, useRef, useState } from 'react';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { throttle } from '~/util/throttle';

const MIN_VALUE = 75;
const MAX_VALUE = 155;
const EMIT_THROTTLE_MS = 100;

export const TempoSliderContainer = (): JSX.Element => {
  const { changeTempo, tempo } = useAbletonContext();
  // changeTempo only updates context tempo once the backend ACKs the emit
  // (see useAbletonContextProviderState), so throttling it directly would
  // make the slider visibly lag behind the user's finger. This tracks the
  // drag position locally for instant feedback, independent of the
  // throttled emission below.
  const [displayTempo, setDisplayTempo] = useState(tempo);
  // Every set_tempo emission - including this component's own - gets
  // broadcast back as an ack/tempo_changed and lands in `tempo`. Sync'ing
  // unconditionally would let a stale leading-edge echo (e.g. the drag's
  // starting value) snap the display backward mid-drag, before the
  // trailing emission's own echo catches it back up. Suppress the sync
  // while the user is actively dragging; the drag's own local updates are
  // already authoritative until release.
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setDisplayTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    // Fallback for a drag that ends without pointerup/pointercancel/blur
    // ever firing on the element itself (e.g. the OS/window loses focus
    // mid-drag - a blur doesn't fire from mere OS-level focus loss, and
    // pointercancel isn't guaranteed if release happens while the browser
    // isn't the OS pointer-capture target). Without this, isDraggingRef
    // could get stuck true for this instance's remaining lifetime.
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

  const throttledChangeTempo = useMemo(
    () => throttle(changeTempo, EMIT_THROTTLE_MS),
    [changeTempo],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTempo = parseInt(e.target.value, 10);
    setDisplayTempo(newTempo);
    throttledChangeTempo(newTempo);
  }

  function handleDragStart() {
    isDraggingRef.current = true;
  }

  function handleDragEnd() {
    isDraggingRef.current = false;
  }

  return (
    <div className='text-center flex flex-col items-center gap-4 min-h-[180px] relative'>
      <label
        htmlFor='tempo-slider'
        className='absolute2 block text-3xl font-medium stroke-black font-fondamento mb-3'
      >
        <strong>{Math.ceil(displayTempo)}</strong> BPM
      </label>
      <div className='flex items-center text-lg h-[100px]'>
        <span className='relative text-gray-500 dark:text-gray-400 self-end left-[20px]'>
          {MIN_VALUE}
        </span>
        <input
          id='tempo-slider'
          type='range'
          min={MIN_VALUE}
          max={MAX_VALUE}
          value={displayTempo}
          onChange={handleChange}
          onPointerDown={handleDragStart}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onBlur={handleDragEnd}
          className='w-[31vw] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 custom-tempo-slider'
        />
        <span className='relative text-gray-500 dark:text-gray-400 self-end right-[20px] z-[-1]'>
          {MAX_VALUE}
        </span>
      </div>
    </div>
  );
};
