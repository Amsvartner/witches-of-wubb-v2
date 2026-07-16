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
      className = 'bg-blue-700';
      break;
    case ClipTypes.Melody:
      // WOW-007A (human, 2026-07-15): warm the Melody hue from the old mustard
      // yellow-700 toward a warmer golden yellow. Kept a yellow (not amber/orange)
      // per the sign-off. ColorUtil stays the single source of truth (PRD F4).
      // TODO(human): re-verify this warm yellow against the physical pillar LEDs
      // before it ships to the installation (PROJECT_BRIEF).
      className = 'bg-yellow-600';
      break;
  }
  return className;
};

export const ColorUtil = {
  getBackgroundColorFromType,
};
