'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, orderBy, limit, startAfter, getDocs, where, QueryDocumentSnapshot, DocumentData 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { Transaction } from './useFinanceData';

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  status?: 'cleared' | 'uncleared' | 'reconciled' | 'all';
  accountId?: string | null;
  searchQuery?: string;
}

export function usePaginatedTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  const { selectedMonth } = useFinance();
  const { accountId, status, startDate: filterStartDate, endDate: filterEndDate, searchQuery } = filters;
  
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
      let q = query(collection(db, 'users', user.uid, 'transactions'));

      if (searchQuery && searchQuery.trim() !== '') {
        // Keyword search (Starts-with)
        // Firestore requires range filters to be the first orderBy field
        q = query(
          q,
          where('payee', '>=', searchQuery),
          where('payee', '<=', searchQuery + '\uf8ff'),
          orderBy('payee', 'asc'),
          orderBy('date', 'desc')
        );
      } else {
        // Date range filtering
        let rangeStart = filterStartDate;
        let rangeEnd = filterEndDate;

        if (!rangeStart || !rangeEnd) {
          rangeStart = `${selectedMonth}-01`;
          const nextMonthDate = new Date(selectedMonth + '-01');
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
          rangeEnd = nextMonthDate.toISOString().slice(0, 7) + '-01';
        }

        q = query(
          q,
          where('date', '>=', rangeStart),
          where('date', '<', rangeEnd),
          orderBy('date', 'desc')
        );
      }

      if (accountId) {
        q = query(q, where('accountId', '==', accountId));
      }

      if (status && status !== 'all') {
        q = query(q, where('status', '==', status));
      }

      q = query(q, limit(PAGE_SIZE));

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
  }, [user, selectedMonth, accountId, status, filterStartDate, filterEndDate, searchQuery, lastDoc]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMonth, accountId, status, filterStartDate, filterEndDate, searchQuery]);

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    fetchNextPage: () => !loadingMore && hasMore && fetchTransactions(true)
  };
}