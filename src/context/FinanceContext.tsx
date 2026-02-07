'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FinanceContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [selectedMonth, setSelectedMonth] = useState(() => 
    new Date().toISOString().slice(0, 7)
  );

  return (
    <FinanceContext.Provider value={{ selectedMonth, setSelectedMonth }}>
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
