import { useEffect, useMemo, useRef, useState } from 'react';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { throttle } from '~/util/throttle';

const MIN_VALUE = 0;
const MAX_VALUE = 0.7;
const RESET_VALUE = 0.6;
const EMIT_THROTTLE_MS = 100;

type Props = { pillar: number };

export const VolumeSliderContainer = ({ pillar }: Props): JSX.Element => {
  const { trackVolume, changeTrackVolume } = useAbletonContext();
  const contextVolume = Math.min(trackVolume[pillar] ?? 0, MAX_VALUE);
  // changeTrackVolume is fire-and-forget - trackVolume only updates once the
  // backend re-broadcasts volume_changed, so throttling the emission
  // directly would make the slider visibly lag. Track the drag position
  // locally for instant feedback, independent of the throttled emission.
  const [displayVolume, setDisplayVolume] = useState(contextVolume);
  // Every set_track_volume emission - including this component's own -
  // gets re-broadcast as volume_changed and lands in `contextVolume`.
  // Sync'ing unconditionally would let a stale leading-edge echo snap the
  // display backward mid-drag, before the trailing emission's own echo
  // catches it back up. Suppress the sync while the user is actively
  // dragging; the drag's own local updates are already authoritative
  // until release.
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setDisplayVolume(contextVolume);
  }, [contextVolume]);

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

  const throttledChangeTrackVolume = useMemo(
    () => throttle(changeTrackVolume, EMIT_THROTTLE_MS),
    [changeTrackVolume],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = Number(e.target.value);
    setDisplayVolume(newVolume);
    throttledChangeTrackVolume({ pillar, volume: newVolume });
  }

  function handleDragStart() {
    isDraggingRef.current = true;
  }

  function handleDragEnd() {
    isDraggingRef.current = false;
  }

  function resetVolume() {
    // A drag's trailing emission may still be pending when Reset is
    // pressed - without cancelling it, that stale dragged value would fire
    // moments later and silently undo the reset.
    throttledChangeTrackVolume.cancel();
    setDisplayVolume(RESET_VALUE);
    changeTrackVolume({ pillar, volume: RESET_VALUE });
  }

  return (
    <>
      <div id={`${pillar}-volume-range`} className='w-full max-h-full flex flex-col items-center'>
        <label
          htmlFor={`${pillar}-volume-range`}
          className={
            'block mb-2 text-sm font-medium stroke-black font-fondamento' +
            (pillar % 2 === 0 ? ' text-left' : '')
          }
        >
          Volume
        </label>
        <div className='flex flex-row text-lg max-h-full gap-4 justify-center h-[170px]'>
          <input
            id={`${pillar}-volume-range`}
            type='range'
            min={MIN_VALUE}
            max={MAX_VALUE}
            step={0.01}
            value={displayVolume}
            onChange={handleChange}
            onPointerDown={handleDragStart}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onBlur={handleDragEnd}
            className='h-2 w-[170px] cursor-pointer accent-red-800 custom-volume-slider'
          />
        </div>
        <button
          onClick={resetVolume}
          className='bg-white font-fondamento hover:bg-gray-100 text-gray-800 font-semibold px-1 w-min border border-gray-400 rounded shadow mt-4'
        >
          Reset
        </button>
      </div>
    </>
  );
};
