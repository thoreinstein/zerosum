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
  const requestSequenceRef = useRef(0);

  const fetchTransactions = useCallback(async (isNextPage = false) => {
    if (!user) return;
    
    if (isNextPage && !hasMoreRef.current) return;

    const currentSequence = ++requestSequenceRef.current;
    setError(null);
    
    if (isNextPage) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setTransactions([]);
      lastDocRef.current = null;
      hasMoreRef.current = true;
      setHasMore(true);
    }

    try {
      let q = query(collection(db, 'users', user.uid, 'transactions'));

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
            q = query(q, where('date', '<=', filterEndDate));
          }
        } else {
          // Default to month window
          const startOfMonth = `${selectedMonth}-01`;
          let [year, month] = selectedMonth.split('-').map(Number);
          month++;
          if (month > 12) {
            month = 1;
            year++;
          }
          const endOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
          
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
      
      // Ignore results from stale requests
      if (currentSequence !== requestSequenceRef.current) return;

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
      if (currentSequence !== requestSequenceRef.current) return;
      console.error("Error fetching transactions:", error);
      setError(error instanceof Error ? error : new Error('Unknown error fetching transactions'));
      // Keep hasMore as-is so retry is possible
    } finally {
      if (currentSequence === requestSequenceRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
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
