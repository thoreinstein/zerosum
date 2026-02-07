'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface FinanceContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  refreshTransactions: () => void;
  refreshKey: number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [selectedMonth, setSelectedMonth] = useState(() => 
    new Date().toISOString().slice(0, 7)
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTransactions = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <FinanceContext.Provider value={{ selectedMonth, setSelectedMonth, refreshTransactions, refreshKey }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
