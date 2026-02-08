'use client';

import { createContext, useContext } from 'react';
import { useFinanceData } from '@/hooks/useFinanceData';

type DashboardContextType = ReturnType<typeof useFinanceData>;

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardData must be used within a DashboardProvider');
  }
  return context;
}

export const DashboardProvider = DashboardContext.Provider;
