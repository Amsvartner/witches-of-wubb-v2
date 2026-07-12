import { VolumeSliderContainer } from '~/container/VolumeSliderContainer';
import { ColorUtil } from '~/util/ColorUtil';
import { useAbletonContext } from '~/context/hook/useAbletonContext';

export const CurrentlyPlayingListContainer = (): JSX.Element => {
  const { queuedClips, playingClips, stoppingClips, clipTempo } = useAbletonContext();

  return (
    <div id='inner_playing' className='w-screen relative'>
      <div id='pillars' className='w-screen grid grid-cols-2 gap-8 justify-items-center'>
        {[1, 2, 3, 4].map((pillar, index) => {
          const playing = playingClips[index];
          const queued = queuedClips[index];
          const stopping = stoppingClips[index];
          const info = queued ?? playing ?? stopping;

          let clipName = '';

          if (info?.artist && info?.songTitle) {
            clipName = `${info?.artist} - ${info?.songTitle}`;
          } else {
            // Intentionally blank, not a fallback to info?.clipName - that's an
            // internal CSV/Ableton clip identifier (e.g. "Flashback Drums 10A
            // 135"), not a visitor-friendly display name. No clip active, or a
            // clip missing artist/songTitle metadata, both show nothing rather
            // than that raw string.
          }

          // determine the color-blur color based on the track type
          const colorBlurClass = ColorUtil.getBackgroundColorFromType(info?.type);

          return (
            <div id={`pillar-${pillar}`} className='w-[55%] text-center' key={pillar}>
              <div className='object-scale-down grid grid-cols-4'>
                <div
                  id='bpm'
                  className={
                    index % 2 === 0
                      ? 'col-start-2 col-span-3 font-fondamento'
                      : 'col-start-1 col-span-3 font-fondamento'
                  }
                >
                  {clipTempo[index] ? `${Math.ceil(clipTempo[index] as number)} ` : ``}BPM
                </div>
                {index % 2 === 0 ? (
                  <div className='object-scale-down max-h-full max-w-full mr-20'>
                    <VolumeSliderContainer pillar={index} />
                  </div>
                ) : null}
                <div className='relative col-span-3 flex justify-items-center'>
                  <div
                    id='color-blur'
                    className={`scale-[110%] absolute -inset-0 rounded-lg blur-xl ${colorBlurClass}`}
                  ></div>
                  <div id='frame_full' className=' border m-auto border-black relative'>
                    <div
                      id='frame_bg'
                      className={`absolute -inset-0 object-scale-down bg-black/25 border m-auto text-center rounded-md border-1 ${
                        (queued || stopping) && 'animate-pulse'
                      }`}
                    >
                      {info?.assetName ? (
                        <img
                          src={`/ingredients/${info?.assetName}`}
                          alt={info?.assetName ?? 'icon'}
                          className={`w-full h-full object-cover rounded-md ${
                            queued && 'opacity-40 animate-pulse'
                          }`}
                        />
                      ) : null}
                    </div>
                    <div
                      id='frame'
                      className='object-scale-down max-h-full max-w-full relative scale-[135%]'
                    >
                      <img src='/images/frame_576_v2.png' alt='Frame'></img>
                    </div>
                  </div>
                </div>
                {index % 2 === 1 ? (
                  <div className='object-scale-down max-h-full max-w-full ml-20'>
                    <VolumeSliderContainer pillar={index} />
                  </div>
                ) : null}
              </div>
              {index % 2 === 0 ? (
                <div className='grid grid-cols-4'>
                  <div
                    id='clip-name'
                    className='mt-[10px] min-h-[30px] stroke-black font-fondamento justify-center col-start-2 col-span-3 max-h-full max-w-full text-center text-lg'
                  >
                    {clipName}
                  </div>
                </div>
              ) : null}
              {index % 2 === 1 ? (
                <div className='grid grid-cols-4'>
                  <div
                    id='clip-name'
                    className='mt-[10px] min-h-[30px] stroke-black font-fondamento justify-center col-start-1 col-span-3 max-h-full max-w-full text-center text-lg'
                  >
                    {clipName}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div data-testid='cauldron' className='scale-95 absolute top-[20%] left-[36.5%] h-[400px]'>
        <img
          className='object-scale-down h-full'
          src='/images/cauldron-hottub-crop.gif'
          alt='Cauldron'
        />
      </div>
    </div>
  );
};
