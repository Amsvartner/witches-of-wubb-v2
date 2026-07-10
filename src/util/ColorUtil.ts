import { ClipTypes } from 'backend/type/ClipTypes';

const getBackgroundColorFromType = (type?: ClipTypes | string): string => {
  let className = 'bg-white';
  // let className = 'bg-purple-700';
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
      className = 'bg-yellow-700';
      break;
  }
  return className;
};

export const ColorUtil = {
  getBackgroundColorFromType,
};
