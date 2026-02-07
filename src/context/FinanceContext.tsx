'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { useSubscriptionPool, PooledMonthData } from '@/hooks/useSubscriptionPool';
import { Category } from '@/hooks/useFinanceData';

interface FinanceContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  refreshTransactions: () => void;
  refreshKey: number;
  pooledData: Record<string, PooledMonthData>;
  budgetCache: Record<string, Category[]>;
  setBudgetCache: (month: string, categories: Category[]) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [selectedMonth, setSelectedMonth] = useState(() => 
    new Date().toISOString().slice(0, 7)
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [budgetCache, setBudgetCacheInternal] = useState<Record<string, Category[]>>({});
  
  // Track access order for LRU pruning
  const accessOrder = useRef<string[]>([]);

  const pooledData = useSubscriptionPool(selectedMonth);

  const setBudgetCache = useCallback((month: string, categories: Category[]) => {
    setBudgetCacheInternal(prev => {
      // If no change, skip update to prevent re-renders
      if (prev[month] === categories) return prev;

      const next = { ...prev, [month]: categories };
      
      // Update LRU access order
      accessOrder.current = [month, ...accessOrder.current.filter(m => m !== month)];
      
      // Prune to 3 months
      if (Object.keys(next).length > 3) {
        const toRemove = accessOrder.current.pop();
        if (toRemove && toRemove !== selectedMonth) {
          delete next[toRemove];
        }
      }
      
      return next;
    });
  }, [selectedMonth]);

  const refreshTransactions = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <FinanceContext.Provider value={{ 
      selectedMonth, 
      setSelectedMonth, 
      refreshTransactions, 
      refreshKey,
      pooledData,
      budgetCache,
      setBudgetCache
    }}>
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
