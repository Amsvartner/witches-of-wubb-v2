import { PlayModeContainer } from '~/container/PlayModeContainer';

/**
 * Play-mode screen (WOW-007A visual-fidelity spike) — the renamed "normal" mode
 * (human, 2026-07-15). Thin view wrapper: sets the grimoire page ground and the
 * default UI font, then composes the play-mode container. Static/mock only.
 */
export const PlayScreen = (): JSX.Element => (
  <div className='min-h-screen w-full bg-grimoire-page font-data text-parchment'>
    <PlayModeContainer />
  </div>
);
