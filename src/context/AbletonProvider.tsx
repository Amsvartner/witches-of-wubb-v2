import { FC, PropsWithChildren } from 'react';
import { AbletonContext } from './AbletonContext';
import { useAbletonContextProviderState } from '~/context/hook/useAbletonContextProviderState';

export const AbletonProvider: FC<PropsWithChildren> = ({ children }) => {
  const state = useAbletonContextProviderState();

  return <AbletonContext.Provider value={state}>{children}</AbletonContext.Provider>;
};
