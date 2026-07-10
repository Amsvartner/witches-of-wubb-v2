import { useState, useEffect } from 'react';
import { CurrentlyPlayingListContainer } from '~/container/CurrentlyPlayingListContainer';
import { DebugModalContainer } from '~/container/DebugModalContainer';
import { TempoSliderContainer } from '~/container/TempoSliderContainer';
import { RecipeBoxContainer } from '~/container/RecipeBoxContainer';
import { KeyAdjusterContainer } from '~/container/KeyAdjusterContainer';

export const InstallationPage = (): JSX.Element => {
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
      <div id='container_recipe_box' className='fixed bottom-0'>
        <button onClick={() => setIsModalOpen(true)} className='absolute start-0 p-4 z-10'>
          &nbsp;&nbsp;&nbsp;
        </button>
        <RecipeBoxContainer />
      </div>
      <DebugModalContainer isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
    </div>
  );
};
