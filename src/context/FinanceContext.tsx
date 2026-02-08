'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSubscriptionPool, PooledMonthData } from '@/hooks/useSubscriptionPool';
import type { Category } from '@/hooks/useFinanceData';

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

function FinanceProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const rawMonth = searchParams.get('month');
  const selectedMonth = (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) ? rawMonth : currentMonth;

  const [refreshKey, setRefreshKey] = useState(0);
  const [budgetCache, setBudgetCacheInternal] = useState<Record<string, Category[]>>({});
  
  // Track access order for LRU pruning
  const accessOrder = useRef<string[]>([]);

  const pooledData = useSubscriptionPool(selectedMonth);

  const setSelectedMonth = useCallback((month: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', month);
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const setBudgetCache = useCallback((month: string, categories: Category[]) => {
    setBudgetCacheInternal(prev => {
      // If no change, skip update to prevent re-renders
      if (prev[month] === categories) return prev;

      const next = { ...prev, [month]: categories };
      
      // Update LRU access order
      accessOrder.current = [month, ...accessOrder.current.filter(m => m !== month)];
      
      // Prune to 3 months
      while (Object.keys(next).length > 3 && accessOrder.current.length > 0) {
        const toRemove = accessOrder.current.pop();
        if (toRemove && toRemove !== selectedMonth && toRemove in next) {
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

export function FinanceProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900" />}>
      <FinanceProviderInner>{children}</FinanceProviderInner>
    </Suspense>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
