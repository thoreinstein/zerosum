'use client';

import { useEffect, useCallback, useRef } from 'react';
import { scanReceipt } from '@/app/actions/scanReceipt';
import { Transaction } from '@/hooks/useFinanceData';
import { writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const DB_NAME = 'zerosum_ai_cache';
const STORE_NAME = 'receipt_images';

export function useAIQueue(
  transactions: Transaction[],
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>,
  categoryNames: string[]
) {
  const { user } = useAuth();
  const transactionsRef = useRef<Transaction[]>(transactions);

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

  const getImage = useCallback(async (txId: string): Promise<string> => {
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
    if (!user) return;

    const pending = transactionsRef.current.filter(t => t.scanStatus === 'pending');
    for (const tx of pending) {
      try {
        await updateTransaction(tx.id, { scanStatus: 'scanning' });
        const image = await getImage(tx.id);
        if (!image) {
          await updateTransaction(tx.id, { scanStatus: 'failed' });
          continue;
        }

        const result = await scanReceipt(image, categoryNames);
        if (result.success && result.data) {
          const { payee, amount, date, category } = result.data;
          const finalAmount = amount ? -Math.abs(amount) : 0;
          const diff = finalAmount - tx.amount;

          // 1. Update the transaction via the mutation framework (handles rollback/retry)
          await updateTransaction(tx.id, {
            payee: payee || tx.payee,
            amount: finalAmount,
            date: date || tx.date,
            category: category || tx.category,
            scanStatus: 'completed'
          });

          // 2. Adjust account balance separately if needed
          if (diff !== 0) {
            const batch = writeBatch(db);
            const accRef = doc(db, 'users', user.uid, 'accounts', tx.accountId);
            batch.update(accRef, { balance: increment(diff) });
            await batch.commit();
          }

          await deleteImage(tx.id);
        } else {
          console.error('Scan failed:', result.error);
          await updateTransaction(tx.id, { scanStatus: 'failed' });
        }
      } catch (error) {
        console.error('Error processing queue item:', error);
        await updateTransaction(tx.id, { scanStatus: 'failed' });
      }
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
