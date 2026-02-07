'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, orderBy, limit, startAfter, getDocs, where, QueryDocumentSnapshot, DocumentData 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { Transaction } from './useFinanceData';

export function usePaginatedTransactions(accountId?: string | null) {
  const { user } = useAuth();
  const { selectedMonth } = useFinance();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const PAGE_SIZE = 20;

  const fetchTransactions = useCallback(async (isNextPage = false) => {
    if (!user) return;
    
    if (isNextPage) setLoadingMore(true);
    else {
      setLoading(true);
      setTransactions([]);
      setLastDoc(null);
      setHasMore(true);
    }

    try {
      const startOfMonth = `${selectedMonth}-01`;
      // End of month is tricky, but let's just use the next month prefix
      const nextMonthDate = new Date(selectedMonth + '-01');
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const endOfMonth = nextMonthDate.toISOString().slice(0, 7) + '-01';

      let q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', startOfMonth),
        where('date', '<', endOfMonth),
        orderBy('date', 'desc'),
        limit(PAGE_SIZE)
      );

      if (accountId) {
        q = query(q, where('accountId', '==', accountId));
      }

      if (isNextPage && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      
      const newTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));

      if (isNextPage) {
        setTransactions(prev => [...prev, ...newTransactions]);
      } else {
        setTransactions(newTransactions);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, selectedMonth, accountId, lastDoc]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMonth, accountId]);

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    fetchNextPage: () => !loadingMore && hasMore && fetchTransactions(true)
  };
}
