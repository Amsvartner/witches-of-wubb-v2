import { createContext } from 'react';
import { AbletonContextState } from '~/context/type/AbletonContextState';

export const AbletonContext = createContext<AbletonContextState | null>(null);
