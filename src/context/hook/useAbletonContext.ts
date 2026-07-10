import { AbletonContextState } from '~/context/type/AbletonContextState';
import { useContext } from 'react';
import { AbletonContext } from '~/context/AbletonContext';

export const useAbletonContext = (): AbletonContextState => {
  const state = useContext(AbletonContext);

  if (!state) {
    throw new Error('useAbletonContext must be used within an AbletonProvider');
  }

  return state;
};
