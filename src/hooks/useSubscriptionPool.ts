import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, onSnapshot, where, orderBy, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { MonthlyAllocation, Transaction } from './useFinanceData';

export interface PooledMonthData {
  allocations: MonthlyAllocation[];
  transactions: Transaction[];
  status: 'loading' | 'synced' | 'error';
  allocReady?: boolean;
  txReady?: boolean;
}

/**
 * Manages a pool of Firestore subscriptions for adjacent months.
 * Implements a 2-second idle delay before prefetching to optimize quota usage.
 */
export function useSubscriptionPool(baseMonth: string) {
  const { user } = useAuth();
  const [pooledData, setPooledData] = useState<Record<string, PooledMonthData>>({});
  
  const unsubs = useRef<Record<string, Unsubscribe[]>>({});

  useEffect(() => {
    if (!user) {
      Object.values(unsubs.current).forEach(monthUnsubs => {
        monthUnsubs.forEach(u => u());
      });
      unsubs.current = {};
      setPooledData({});
      return;
    }

    // 2-second idle delay before prefetching
    const timer = setTimeout(() => {
      const adjacent = getAdjacentMonths(baseMonth);
      
      // Cleanup months no longer adjacent or active
      const monthsToKeep = [...adjacent, baseMonth];
      Object.keys(unsubs.current).forEach(m => {
        if (!monthsToKeep.includes(m)) {
          unsubs.current[m].forEach(u => u());
          delete unsubs.current[m];
          setPooledData(prev => {
            const next = { ...prev };
            delete next[m];
            return next;
          });
        }
      });

      // Attach new listeners for adjacent months
      adjacent.forEach(m => {
        if (!unsubs.current[m]) {
          setPooledData(prev => ({
            ...prev,
            [m]: { allocations: [], transactions: [], status: 'loading', allocReady: false, txReady: false }
          }));

          const qAlloc = query(
            collection(db, 'users', user.uid, 'monthly_allocations'),
            where('month', '==', m)
          );
          
          const start = `${m}-01`;
          const end = `${m}-31`;
          
          const qTx = query(
            collection(db, 'users', user.uid, 'transactions'),
            where('date', '>=', start),
            where('date', '<=', end),
            orderBy('date', 'desc')
          );

          const handleError = () => {
            setPooledData(prev => ({
              ...prev,
              [m]: { ...prev[m], status: 'error' }
            }));
          };

          const unsubAlloc = onSnapshot(qAlloc, { includeMetadataChanges: true }, (snap) => {
            const allocations = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAllocation));
            setPooledData(prev => {
              const monthData = prev[m] || { allocations: [], transactions: [], status: 'loading', allocReady: false, txReady: false };
              const allocReady = !snap.metadata.fromCache || monthData.allocReady;
              return {
                ...prev,
                [m]: { 
                  ...monthData, 
                  allocations: allocations || [],
                  allocReady,
                  status: (allocReady && monthData.txReady) ? 'synced' : 'loading'
                }
              };
            });
          }, handleError);

          const unsubTx = onSnapshot(qTx, { includeMetadataChanges: true }, (snap) => {
            const transactions = snap.docs.map(d => ({ 
              id: d.id, 
              ...d.data(),
              isPending: d.metadata.hasPendingWrites
            } as Transaction));
            setPooledData(prev => {
              const monthData = prev[m] || { allocations: [], transactions: [], status: 'loading', allocReady: false, txReady: false };
              const txReady = !snap.metadata.fromCache || monthData.txReady;
              return {
                ...prev,
                [m]: { 
                  ...monthData, 
                  transactions: transactions || [],
                  txReady,
                  status: (monthData.allocReady && txReady) ? 'synced' : 'loading'
                }
              };
            });
          }, handleError);

          unsubs.current[m] = [unsubAlloc, unsubTx];
        }
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [baseMonth, user]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(unsubs.current).forEach(monthUnsubs => {
        monthUnsubs.forEach(u => u());
      });
      unsubs.current = {};
    };
  }, []);

  return pooledData;
}

function getAdjacentMonths(month: string) {
  const [year, mon] = month.split('-').map(Number);
  
  // Previous Month
  const prevDate = new Date(year, mon - 2);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  
  // Next Month
  const nextDate = new Date(year, mon);
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
  
  return [prevMonth, nextMonth];
}
