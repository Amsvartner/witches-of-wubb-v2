import { useState } from 'react';
import { PlayModeStateMock } from '~/mock/PlayModeStateMock';
import { Wordmark } from '~/component/Wordmark';
import { TopControls } from '~/component/TopControls';
import { PillarCard } from '~/component/PillarCard';
import { Cauldron } from '~/component/Cauldron';
import { SettingsBand } from '~/component/SettingsBand';
import { SettingsModal } from '~/component/SettingsModal';
import { Legend } from '~/component/Legend';

/**
 * Play-mode screen composition (WOW-007A visual spike). Static mock data only —
 * no socket wiring. Lays out the wireframe-authoritative structure: wordmark +
 * visible Help/Settings on top, a 2×2 pillar grid around the central cauldron,
 * then the settings band and legend. Design-first at 1024×1280 (lg); reflows to
 * a single column below that (DESIGN_PROPOSAL_001 §5, responsive behaviour).
 * Holds the spike's only interactive state: the Settings modal and its
 * global animations kill-switch (performance escape hatch, human 2026-07-17).
 */
export const PlayModeContainer = (): JSX.Element => {
  const state = PlayModeStateMock.create();
  const [p1, p2, p3, p4] = state.pillars;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  return (
    <div className='mx-auto flex min-h-screen max-w-[1024px] flex-col px-8 py-4'>
      <header>
        <div className='flex justify-end'>
          <TopControls onOpenSettings={() => setIsSettingsOpen(true)} />
        </div>
        {/* Raised into the Help/Settings row so the logo keeps clear air above
            the pillar grid (human, 2026-07-17); no horizontal overlap at 1024. */}
        <div className='-mt-9 flex justify-center pb-1'>
          <Wordmark />
        </div>
      </header>

      <div className='mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_180px_1fr] lg:grid-rows-2'>
        <div className='relative z-10 min-w-0 lg:col-start-1 lg:row-start-1'>
          <PillarCard pillar={p1} animationsEnabled={animationsEnabled} />
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-3 lg:row-start-1'>
          <PillarCard pillar={p2} animationsEnabled={animationsEnabled} />
        </div>
        {/* Oversized focal cauldron — deliberately extends behind the pillar
            cards (human, 2026-07-17); cards layer above via z-10. */}
        <div className='relative z-0 flex items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1'>
          <div className='w-full max-w-[320px] lg:absolute lg:left-1/2 lg:top-1/2 lg:w-[405px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2'>
            <Cauldron animated={animationsEnabled} />
          </div>
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-1 lg:row-start-2'>
          <PillarCard pillar={p3} animationsEnabled={animationsEnabled} />
        </div>
        <div className='relative z-10 min-w-0 lg:col-start-3 lg:row-start-2'>
          <PillarCard pillar={p4} animationsEnabled={animationsEnabled} />
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

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        animationsEnabled={animationsEnabled}
        onAnimationsEnabledChange={setAnimationsEnabled}
      />
    </div>
  );
};
