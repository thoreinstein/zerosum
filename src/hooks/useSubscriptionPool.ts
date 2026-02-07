import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, onSnapshot, where, orderBy, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { MonthlyAllocation, Transaction } from './useFinanceData';

/**
 * Manages a pool of Firestore subscriptions for adjacent months.
 * Implements a 2-second idle delay before prefetching to optimize quota usage.
 */
export function useSubscriptionPool(baseMonth: string) {
  const { user } = useAuth();
  const [pooledData, setPooledData] = useState<Record<string, { 
    allocations: MonthlyAllocation[], 
    transactions: Transaction[] 
  }>>({});
  
  const unsubs = useRef<Record<string, Unsubscribe[]>>({});

  useEffect(() => {
    if (!user) return;

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
          console.log(`[SubscriptionPool] Detached listeners for ${m}`);
        }
      });

      // Attach new listeners for adjacent months
      adjacent.forEach(m => {
        if (!unsubs.current[m]) {
          console.log(`[SubscriptionPool] Attaching listeners for ${m}`);
          
          const qAlloc = query(
            collection(db, 'users', user.uid, 'monthly_allocations'),
            where('month', '==', m)
          );
          
          // Windowed transaction query for the month
          const start = `${m}-01`;
          const end = `${m}-31`; // Simplified end-of-month for prefix query logic
          
          const qTx = query(
            collection(db, 'users', user.uid, 'transactions'),
            where('date', '>=', start),
            where('date', '<=', end),
            orderBy('date', 'desc')
          );

          const unsubAlloc = onSnapshot(qAlloc, { includeMetadataChanges: true }, (snap) => {
            const allocations = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAllocation));
            setPooledData(prev => ({
              ...prev,
              [m]: { ...prev[m], allocations: allocations || [] }
            }));
          });

          const unsubTx = onSnapshot(qTx, { includeMetadataChanges: true }, (snap) => {
            const transactions = snap.docs.map(d => ({ 
              id: d.id, 
              ...d.data(),
              isPending: d.metadata.hasPendingWrites
            } as Transaction));
            setPooledData(prev => ({
              ...prev,
              [m]: { ...prev[m], transactions: transactions || [] }
            }));
          });

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
