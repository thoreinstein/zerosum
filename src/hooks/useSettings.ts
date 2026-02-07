import { useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { terminate, clearIndexedDbPersistence, waitForPendingWrites } from 'firebase/firestore';

export function useSettings() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const forceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      // 1. Attempt to wait for pending writes (5s timeout)
      const waitPromise = waitForPendingWrites(db);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout waiting for pending writes')), 5000)
      );

      try {
        await Promise.race([waitPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Proceeding with refresh despite pending writes timeout or error:', e);
      }

      // 2. Terminate Firestore
      await terminate(db);

      // 3. Clear persistence (might fail if other tabs are open)
      try {
        await clearIndexedDbPersistence(db);
      } catch (e) {
        console.warn('Persistence clear failed, but proceeding with reload:', e);
      }

      // 4. Reload page to recover app state
      window.location.reload();
    } catch (error) {
      console.error('Force refresh failed:', error);
      setRefreshError(error instanceof Error ? error.message : 'An unknown error occurred');
      setIsRefreshing(false);
    }
  }, []);

  return {
    forceRefresh,
    isRefreshing,
    refreshError
  };
}
