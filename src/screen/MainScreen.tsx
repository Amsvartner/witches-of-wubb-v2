import { useState, useEffect } from 'react';
import { CurrentlyPlayingListContainer } from '~/container/CurrentlyPlayingListContainer';
import { DebugModalContainer } from '~/container/DebugModalContainer';
import { TempoSliderContainer } from '~/container/TempoSliderContainer';
import { KeyAdjusterContainer } from '~/container/KeyAdjusterContainer';

export const MainScreen = (): JSX.Element => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup function to remove the event listener when the component is unmounted
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <div id='container_playing' className='overflow-hidden max-h-screen'>
      <div className='flex justify-center'>
        <KeyAdjusterContainer />
      </div>
      <CurrentlyPlayingListContainer />
      <div id='container_tempo' className='flex justify-center'>
        <TempoSliderContainer />
      </div>
      {/* Legacy screen's debug entry (unthemed — this screen predates the
          witchy visual rework). Was an invisible hidden-gesture button
          layered over the now-removed RecipeBox; replaced with a plainly
          visible, ≥44px bottom-left toggle (human direction 2026-07-20).
          RecipeBoxContainer/useGrimoire (recipe suggestions + random spell
          names) are removed per the confirmed design direction in
          docs/UX_UI_PRINCIPLES.md ("Recipe suggestions AND random spell
          names removed entirely — useGrimoire goes"). */}
      <button
        type='button'
        onClick={() => setIsModalOpen((open) => !open)}
        aria-pressed={isModalOpen}
        className='fixed bottom-4 left-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-500 bg-gray-800 px-4 py-2 text-sm text-gray-100'
      >
        Debug
      </button>
      <DebugModalContainer isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
    </div>
  );
};
