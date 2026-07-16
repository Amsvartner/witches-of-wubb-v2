import { PlayModeStateMock } from '~/mock/PlayModeStateMock';
import { Wordmark } from '~/component/Wordmark';
import { TopControls } from '~/component/TopControls';
import { PillarCard } from '~/component/PillarCard';
import { Cauldron } from '~/component/Cauldron';
import { SettingsBand } from '~/component/SettingsBand';
import { Legend } from '~/component/Legend';

/**
 * Play-mode screen composition (WOW-007A visual spike). Static mock data only —
 * no socket wiring. Lays out the wireframe-authoritative structure: wordmark +
 * visible Help/Settings on top, a 2×2 pillar grid around the central cauldron,
 * then the settings band and legend. Design-first at 1024×1280 (lg); reflows to
 * a single column below that (DESIGN_PROPOSAL_001 §5, responsive behaviour).
 */
export const PlayModeContainer = (): JSX.Element => {
  const state = PlayModeStateMock.create();
  const [p1, p2, p3, p4] = state.pillars;

  return (
    <div className='mx-auto flex min-h-screen max-w-[1024px] flex-col px-8 py-4'>
      <header>
        <div className='flex justify-end'>
          <TopControls />
        </div>
        <div className='flex justify-center pb-1'>
          <Wordmark />
        </div>
      </header>

      <div className='mt-3 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-2'>
        <div className='lg:col-start-1 lg:row-start-1'>
          <PillarCard pillar={p1} />
        </div>
        <div className='lg:col-start-3 lg:row-start-1'>
          <PillarCard pillar={p2} />
        </div>
        <div className='flex items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1'>
          <Cauldron />
        </div>
        <div className='lg:col-start-1 lg:row-start-2'>
          <PillarCard pillar={p3} />
        </div>
        <div className='lg:col-start-3 lg:row-start-2'>
          <PillarCard pillar={p4} />
        </div>
      </div>

      <div className='mt-4'>
        <SettingsBand
          tempoBpm={state.tempoBpm}
          tempoMin={state.tempoMin}
          tempoMax={state.tempoMax}
          autoAdjustKey={state.autoAdjustKey}
          currentKey={state.currentKey}
          keyQuality={state.keyQuality}
          keyDifference={state.keyDifference}
        />
      </div>

      <div className='mt-2 border-t border-gold-line/20 pt-3'>
        <Legend />
      </div>
    </div>
  );
};
