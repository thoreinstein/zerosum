'use client';

import { useEffect, useCallback, useRef } from 'react';
import { scanReceipt } from '@/app/actions/scanReceipt';
import { Transaction } from '@/hooks/useFinanceData';
import { useAuth } from '@/context/AuthContext';

const DB_NAME = 'zerosum_ai_cache';
const STORE_NAME = 'receipt_images';

export function useAIQueue(
  transactions: Transaction[],
  updateTransaction: (id: string, data: Partial<Transaction>, _isRetry?: boolean) => Promise<void>,
  categoryNames: string[]
) {
  const { user } = useAuth();
  const transactionsRef = useRef<Transaction[]>(transactions);
  const isProcessingRef = useRef(false);

  // Sync ref with latest transactions
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  
  const initDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const storeImage = useCallback(async (txId: string, base64Image: string) => {
    const db = await initDB();
    try {
      return await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(base64Image, txId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, [initDB]);

  const getImage = useCallback(async (txId: string): Promise<string | undefined> => {
    const db = await initDB();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(txId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, [initDB]);

  const deleteImage = useCallback(async (txId: string) => {
    const db = await initDB();
    try {
      return await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(txId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, [initDB]);

  const processQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!user || isProcessingRef.current) return;

    // Pick up pending OR failed items eligible for retry
    const queue = transactionsRef.current.filter(t => 
      t.scanStatus === 'pending' || 
      (t.scanStatus === 'failed' && (t.scanRetryCount || 0) < 3)
    );

    if (queue.length === 0) return;

    isProcessingRef.current = true;
    try {
      for (const tx of queue) {
        try {
          await updateTransaction(tx.id, { scanStatus: 'scanning' });
          const image = await getImage(tx.id);
          if (!image) {
            const nextRetry = (tx.scanRetryCount || 0) + 1;
            await updateTransaction(tx.id, { 
              scanStatus: 'failed',
              scanRetryCount: nextRetry,
              scanLastError: 'Image not found in local cache'
            });
            continue;
          }

          const result = await scanReceipt(image, categoryNames);
          if (result.success && result.data) {
            const { payee, amount, date, category } = result.data;
            const finalAmount = amount ? -Math.abs(amount) : 0;

            // 1. Update the transaction via the mutation framework (handles rollback/retry)
            await updateTransaction(tx.id, {
              payee: payee || tx.payee,
              amount: finalAmount,
              date: date || tx.date,
              category: category || tx.category,
              scanStatus: 'completed',
              scanRetryCount: 0,
              scanLastError: null
            });

            await deleteImage(tx.id);
          } else {
            const errorInfo = result.error as { code: string, message: string };
            const nextRetry = (tx.scanRetryCount || 0) + 1;
            await updateTransaction(tx.id, { 
              scanStatus: 'failed', 
              scanRetryCount: nextRetry,
              scanLastError: errorInfo?.code || 'SCAN_SERVER_ERROR'
            });
          }
        } catch (error) {
          console.error('Error processing queue item:', error);
          const nextRetry = (tx.scanRetryCount || 0) + 1;
          await updateTransaction(tx.id, { 
              scanStatus: 'failed', 
              scanRetryCount: nextRetry,
              scanLastError: 'SCAN_SERVER_ERROR'
          });
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [updateTransaction, getImage, deleteImage, categoryNames, user]);

  useEffect(() => {
    const interval = setInterval(processQueue, 30000); // Check every 30s
    window.addEventListener('online', processQueue);
    processQueue(); // Run immediately

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', processQueue);
    };
  }, [processQueue]);

  return { storeImage };
}
