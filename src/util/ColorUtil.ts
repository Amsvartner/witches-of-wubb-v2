import { ClipTypes } from 'backend/type/ClipTypes';

const getBackgroundColorFromType = (type?: ClipTypes | string): string => {
  let className = 'bg-white';
  switch (type) {
    case ClipTypes.Vox:
      className = 'bg-red-700';
      break;
    case ClipTypes.Bass:
      className = 'bg-green-700';
      break;
    case ClipTypes.Drums:
      // WOW-007A (human, 2026-07-17): desaturated from blue-700, which read
      // far more intense than the other category hues on the dark page. The
      // value lives in tailwind.config.cjs ('drums-blue'). ColorUtil stays the
      // single source of truth (PRD F4).
      // TODO(human): re-verify against the physical pillar LEDs alongside the
      // Melody warm-yellow change (PROJECT_BRIEF).
      className = 'bg-drums-blue';
      break;
    case ClipTypes.Melody:
      // WOW-007A (human, 2026-07-15/17): warmed from the old mustard yellow-700,
      // then nudged clearly yellow (the physical pillar is yellow) while staying
      // warm — yellow-600 read too brown/amber. The value lives in
      // tailwind.config.cjs ('melody-yellow'). ColorUtil stays the single source
      // of truth (PRD F4).
      // TODO(human): re-verify against the physical pillar LEDs before it ships
      // to the installation (PROJECT_BRIEF).
      className = 'bg-melody-yellow';
      break;
  }
  return className;
};

export const ColorUtil = {
  getBackgroundColorFromType,
};
