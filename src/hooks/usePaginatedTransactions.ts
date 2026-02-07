'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, query, orderBy, limit, startAfter, getDocs, where, QueryDocumentSnapshot, DocumentData 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { Transaction } from './useFinanceData';

const PAGE_SIZE = 20;

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  status?: 'cleared' | 'uncleared' | 'reconciled' | 'all';
  accountId?: string | null;
  searchQuery?: string;
}

export function usePaginatedTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  const { selectedMonth, refreshKey } = useFinance();
  const { accountId, status, startDate: filterStartDate, endDate: filterEndDate, searchQuery } = filters;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Internal tracking refs to keep fetchTransactions identity stable
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchTransactions = useCallback(async (isNextPage = false) => {
    if (!user || isFetchingRef.current) return;
    
    if (isNextPage) {
      if (!hasMoreRef.current) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
      setTransactions([]);
      lastDocRef.current = null;
      hasMoreRef.current = true;
      setHasMore(true);
      setError(null);
    }

    isFetchingRef.current = true;

    try {
      let q = query(collection(db, 'users', user.uid, 'transactions'));
      // ... query building logic

      // 1. Apply WHERE / ORDER BY constraints FIRST
      if (searchQuery && searchQuery.trim() !== '') {
        // Keyword search (Starts-with)
        q = query(
          q,
          where('payee', '>=', searchQuery),
          where('payee', '<=', searchQuery + '\uf8ff'),
          orderBy('payee', 'asc'),
          orderBy('date', 'desc')
        );
      } else {
        // Date range filtering
        const hasCustomDate = filterStartDate || filterEndDate;
        
        if (hasCustomDate) {
          if (filterStartDate) {
            q = query(q, where('date', '>=', filterStartDate));
          }
          if (filterEndDate) {
            q = query(q, where('date', '<', filterEndDate));
          }
        } else {
          // Default to month window
          const startOfMonth = `${selectedMonth}-01`;
          const nextMonthDate = new Date(selectedMonth + '-01');
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
          const endOfMonth = nextMonthDate.toISOString().slice(0, 7) + '-01';
          
          q = query(q, where('date', '>=', startOfMonth), where('date', '<', endOfMonth));
        }

        q = query(q, orderBy('date', 'desc'));
      }

      if (accountId) {
        q = query(q, where('accountId', '==', accountId));
      }

      if (status && status !== 'all') {
        q = query(q, where('status', '==', status));
      }

      // 2. Apply PAGINATION constraints LAST
      q = query(q, limit(PAGE_SIZE));

      if (isNextPage && lastDocRef.current) {
        q = query(q, startAfter(lastDocRef.current));
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

      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      const more = snapshot.docs.length === PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setError(error instanceof Error ? error : new Error('Unknown error fetching transactions'));
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [user, selectedMonth, accountId, status, filterStartDate, filterEndDate, searchQuery]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMonth, accountId, status, filterStartDate, filterEndDate, searchQuery, refreshKey]);

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchNextPage: useCallback(() => fetchTransactions(true), [fetchTransactions]),
    refresh: useCallback(() => fetchTransactions(false), [fetchTransactions])
  };
}
