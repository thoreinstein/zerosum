import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  collection, query, onSnapshot, doc, deleteDoc,
  orderBy, writeBatch, increment, where, getDocs,
  onSnapshotsInSync
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';

export interface PendingMutation {
  id: string;
  type: 'add' | 'update' | 'delete';
  entity: 'transaction' | 'category';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  budgeted: number;
  activity: number;
  available: number;
  spent: number;
  color: string;
  hex: string;
  isRta?: boolean;
  isCcPayment?: boolean;
  linkedAccountId?: string;
  targetType?: 'monthly' | 'balance' | 'balance_by_date';
  targetAmount?: number;
  targetDate?: string;
}

export interface CategoryMetadata {
  id: string;
  name: string;
  color: string;
  hex: string;
  isRta?: boolean;
  isCcPayment?: boolean;
  linkedAccountId?: string;
  targetType?: 'monthly' | 'balance' | 'balance_by_date';
  targetAmount?: number;
  targetDate?: string;
}

export interface MonthlyAllocation {
  id: string;
  month: string;
  categoryId: string;
  budgeted: number;
}

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  category: string;
  amount: number;
  status: 'cleared' | 'reconciled' | 'uncleared';
  accountId: string;
  isPending?: boolean;
  scanStatus?: 'pending' | 'scanning' | 'completed' | 'failed';
}

export function useFinanceData(monthOverride?: string) {
  const { user } = useAuth();
  const { 
    selectedMonth: contextMonth, 
    pooledData, 
    budgetCache, 
    setBudgetCache 
  } = useFinance();
  const selectedMonth = monthOverride || contextMonth;

  // Optimistic & UI State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>([]);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isInitialized = useRef(false);
  const errorBuffer = useRef<string[]>([]);
  const errorTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Data State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [metadata, setMetadata] = useState<CategoryMetadata[]>([]);
  const [allocations, setAllocations] = useState<MonthlyAllocation[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  // Currently, `allocations` and `allTransactions` already represent the full
  // collections, so we don't merge in pooled background data here to avoid
  // redundant Firestore listeners and duplicate data.
  const combinedAllocations = useMemo(() => {
    return allocations;
  }, [allocations]);

  const combinedTransactions = useMemo(() => {
    return allTransactions;
  }, [allTransactions]);

  // Computed/Optimistic State
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Instant hydration from cache & Smart Loading State
  useEffect(() => {
    const isCached = !!budgetCache[selectedMonth];
    const poolStatus = pooledData[selectedMonth]?.status;

    if (isCached) {
      setCategories(budgetCache[selectedMonth]);
      setLoading(false);
    } else if (poolStatus === 'synced') {
      // Data is in pool but not yet calculated/cached
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [selectedMonth, budgetCache, pooledData]);

  const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({
    accounts: false,
    categories: false,
    monthly: false,
    transactions: false
  });
  const [isSyncingGlobal, setIsSyncingGlobal] = useState(false);

  useEffect(() => {
    return onSnapshotsInSync(db, () => {
      setIsSyncingGlobal(false);
    });
  }, []);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const bufferError = useCallback((message: string) => {
    errorBuffer.current.push(message);
    
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
    }

    errorTimer.current = setTimeout(() => {
      const errors = errorBuffer.current;
      errorBuffer.current = [];
      errorTimer.current = null;

      if (errors.length === 1) {
        addToast(errors[0], 'error');
      } else if (errors.length > 1) {
        addToast(`${errors.length} operations failed. Please review pending updates.`, 'error');
      }
    }, 2000);
  }, [addToast]);

  const hasPendingWrites = useMemo(() => Object.values(syncStatus).some(v => v), [syncStatus]);
  const isSyncing = hasPendingWrites || isSyncingGlobal;

  // --- Calculation Logic ---
  const calculateFinances = useCallback(() => {
    if (metadata.length === 0) return;

    // 1. Group transactions by month and category
    const activityMap: Record<string, Record<string, number>> = {};
    combinedTransactions.forEach(tx => {
      const month = tx.date.slice(0, 7);
      if (!activityMap[month]) activityMap[month] = {};
      if (!activityMap[month][tx.category]) activityMap[month][tx.category] = 0;
      activityMap[month][tx.category] += tx.amount;
    });

    // 2. Group allocations by month and category
    const budgetMap: Record<string, Record<string, number>> = {};
    combinedAllocations.forEach(alloc => {
      if (!budgetMap[alloc.month]) budgetMap[alloc.month] = {};
      budgetMap[alloc.month][alloc.categoryId] = alloc.budgeted;
    });

    // 3. Recursive Available Calculation
    const months = Array.from(new Set([
      ...Object.keys(activityMap),
      ...Object.keys(budgetMap),
      selectedMonth
    ])).sort();

    const runningAvailable: Record<string, number> = {};
    const monthResults: Record<string, Record<string, { budgeted: number, activity: number, available: number }>> = {};

    months.forEach(m => {
      monthResults[m] = {};
      let totalBudgetedToCategories = 0;
      
      metadata.forEach(cat => {
        if (cat.isRta || cat.isCcPayment) return;
        const budgeted = budgetMap[m]?.[cat.id] || 0;
        const activity = activityMap[m]?.[cat.name] || 0;
        const prevAvailable = runningAvailable[cat.id] || 0;
        
        const available = prevAvailable + budgeted + activity;
        monthResults[m][cat.id] = { budgeted, activity, available };
        totalBudgetedToCategories += budgeted;
      });

      const ccTransactions = combinedTransactions.filter(tx => {
          const month = tx.date.slice(0, 7);
          const acc = accounts.find(a => a.id === tx.accountId);
          return month === m && acc?.type === 'Credit Card' && tx.amount < 0;
      });

      ccTransactions.forEach(tx => {
          const catMeta = metadata.find(c => c.name === tx.category);
          const ccPaymentMeta = metadata.find(c => c.isCcPayment && c.linkedAccountId === tx.accountId);
          
          if (catMeta && ccPaymentMeta && !catMeta.isRta) {
              const currentAvailable = monthResults[m][catMeta.id]?.available || 0;
              const shiftAmount = Math.min(Math.max(0, currentAvailable + Math.abs(tx.amount)), Math.abs(tx.amount));
              
              if (shiftAmount > 0) {
                  monthResults[m][catMeta.id].available -= shiftAmount;
                  if (!monthResults[m][ccPaymentMeta.id]) {
                      monthResults[m][ccPaymentMeta.id] = { budgeted: budgetMap[m]?.[ccPaymentMeta.id] || 0, activity: 0, available: runningAvailable[ccPaymentMeta.id] || 0 };
                  }
                  monthResults[m][ccPaymentMeta.id].available += shiftAmount;
              }
          }
      });

      metadata.forEach(cat => {
          if (cat.isRta) return;
          if (cat.isCcPayment && !monthResults[m][cat.id]) {
              const budgeted = budgetMap[m]?.[cat.id] || 0;
              const activity = activityMap[m]?.[cat.name] || 0;
              const prevAvailable = runningAvailable[cat.id] || 0;
              monthResults[m][cat.id] = { budgeted, activity, available: prevAvailable + budgeted + activity };
              totalBudgetedToCategories += budgeted;
          }
          if (monthResults[m][cat.id]) {
            runningAvailable[cat.id] = monthResults[m][cat.id].available;
          }
      });

      const rtaMetadata = metadata.find(c => c.isRta);
      if (rtaMetadata) {
          const income = activityMap[m]?.[rtaMetadata.name] || 0;
          const prevRta = runningAvailable[rtaMetadata.id] || 0;
          const available = prevRta + income - totalBudgetedToCategories;
          runningAvailable[rtaMetadata.id] = available;
          monthResults[m][rtaMetadata.id] = { budgeted: 0, activity: income, available };
      }
    });

    months.forEach(m => {
      const merged = metadata.map(catMeta => {
        const stats = monthResults[m]?.[catMeta.id] || { budgeted: 0, activity: 0, available: 0 };
        return {
          ...catMeta,
          budgeted: stats.budgeted,
          activity: stats.activity,
          available: stats.available,
          spent: Math.abs(stats.activity)
        } as Category;
      });

      // Only update global cache for the active month to avoid excessive provider updates
      if (m === selectedMonth) {
        setBudgetCache(m, merged);
        // If this is the active month, set local state for immediate UI feedback
        setCategories(merged);
      }
    });

    // Keep full transaction set for downstream background processors (e.g. AI scan queue)
    setTransactions(combinedTransactions); 
  }, [metadata, combinedAllocations, combinedTransactions, selectedMonth, accounts, setBudgetCache]);

  useEffect(() => {
    calculateFinances();
  }, [calculateFinances]);

  // --- Listeners ---

  // 1. Global Entities (Accounts, Categories)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const qAccounts = query(collection(db, 'users', user.uid, 'accounts'));
    const qCategories = query(collection(db, 'users', user.uid, 'categories'));

    const unsubAccounts = onSnapshot(qAccounts, { includeMetadataChanges: true }, (snapshot) => {
      setIsSyncingGlobal(true);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      setAccounts(data);
      setSyncStatus(prev => ({ ...prev, accounts: snapshot.metadata.hasPendingWrites }));
    });

    const unsubCategories = onSnapshot(qCategories, { includeMetadataChanges: true }, (snapshot) => {
      setIsSyncingGlobal(true);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CategoryMetadata));
      setMetadata(data);
      setSyncStatus(prev => ({ ...prev, categories: snapshot.metadata.hasPendingWrites }));
    });

    return () => {
      unsubAccounts();
      unsubCategories();
    };
  }, [user]);

  // 2. Transactional Data (Monthly Allocations, Transactions)
  useEffect(() => {
    if (!user) return;
    
    // We fetch ALL for now to support accurate running balances
    const qMonthly = query(collection(db, 'users', user.uid, 'monthly_allocations'));
    const qTransactions = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));

    const unsubMonthly = onSnapshot(qMonthly, { includeMetadataChanges: true }, (snapshot) => {
      setIsSyncingGlobal(true);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAllocation));
      setAllocations(data);
      setSyncStatus(prev => ({ ...prev, monthly: snapshot.metadata.hasPendingWrites }));
    });

    const unsubTransactions = onSnapshot(qTransactions, { includeMetadataChanges: true }, (snapshot) => {
      setIsSyncingGlobal(true);
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        isPending: d.metadata.hasPendingWrites
      } as Transaction));
      setAllTransactions(data);
      setSyncStatus(prev => ({ ...prev, transactions: snapshot.metadata.hasPendingWrites }));
      setLoading(false);
    });

    return () => {
      unsubMonthly();
      unsubTransactions();
    };
  }, [user]);

  // --- Side Effects ---

  // Bootstrap missing CC Payment categories (Fixed logic)
  useEffect(() => {
    if (!user || accounts.length === 0 || metadata.length === 0) return;

    const bootstrapCC = async () => {
      const ccAccounts = accounts.filter(a => a.type === 'Credit Card');
      const missingCC = ccAccounts.filter(acc => !metadata.find(m => m.linkedAccountId === acc.id));

      if (missingCC.length === 0) return;

      const batch = writeBatch(db);
      missingCC.forEach((ccAcc) => {
        const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
        batch.set(metaRef, {
          name: `Payment: ${ccAcc.name}`,
          color: 'bg-slate-400',
          hex: '#94a3b8',
          isCcPayment: true,
          linkedAccountId: ccAcc.id
        });
        const allocId = `${selectedMonth}_${metaRef.id}`;
        const allocRef = doc(db, 'users', user.uid, 'monthly_allocations', allocId);
        batch.set(allocRef, {
          month: selectedMonth,
          categoryId: metaRef.id,
          budgeted: 0
        });
      });

      await batch.commit().catch(err => {
        console.error('Failed to bootstrap CC categories:', err);
      });
    };

    bootstrapCC();
  }, [user, accounts, metadata, selectedMonth]);

  // Load/Save Pending Mutations
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('zerosum_pending_mutations');
      if (saved) setPendingMutations(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load pending mutations:', error);
    } finally {
      isInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isInitialized.current || typeof window === 'undefined') return;
    try {
      localStorage.setItem('zerosum_pending_mutations', JSON.stringify(pendingMutations));
    } catch (error) {
      console.error('Failed to save pending mutations:', error);
    }
  }, [pendingMutations]);

  // --- Mutations ---

  const addTransaction = async (txData: Omit<Transaction, 'id'>, id?: string, _isRetry?: boolean) => {
    if (!user) return;
    const txRef = id ? doc(db, 'users', user.uid, 'transactions', id) : doc(collection(db, 'users', user.uid, 'transactions'));
    
    try {
      const accRef = doc(db, 'users', user.uid, 'accounts', txData.accountId);
      const batch = writeBatch(db);
      batch.set(txRef, txData);
      batch.update(accRef, { balance: increment(txData.amount) });

      const ccPaymentCategory = categories.find(c => c.name === txData.category && c.isCcPayment);
      if (ccPaymentCategory?.linkedAccountId) {
          const linkedAccRef = doc(db, 'users', user.uid, 'accounts', ccPaymentCategory.linkedAccountId);
          batch.update(linkedAccRef, { balance: increment(Math.abs(txData.amount)) });
      }

      await batch.commit();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      if (_isRetry) {
        bufferError('Failed to retry adding transaction.');
        throw error;
      }
      setPendingMutations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'add',
        entity: 'transaction',
        data: { ...txData, id: txRef.id },
        timestamp: Date.now()
      }]);
      bufferError('Transaction failed to save. Added to pending updates.');
    }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>, balanceDelta?: number, _isRetry?: boolean) => {
      if (!user) return;
      const original = allTransactions.find(t => t.id === id);
      if (!original) return;

      // Optimistic
      setAllTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      if (balanceDelta && original.accountId) {
          setAccounts(prev => prev.map(a => a.id === original.accountId ? { ...a, balance: a.balance + balanceDelta } : a));
      }

      try {
        const batch = writeBatch(db);
        const txRef = doc(db, 'users', user.uid, 'transactions', id);
        batch.update(txRef, data);
        
        if (balanceDelta && original.accountId) {
             const accRef = doc(db, 'users', user.uid, 'accounts', original.accountId);
             batch.update(accRef, { balance: increment(balanceDelta) });
        }

        await batch.commit();
      } catch (error) {
        console.error('Failed to update transaction:', error);
        // Rollback
        setAllTransactions(prev => prev.map(t => t.id === id ? original : t));
        if (balanceDelta && original.accountId) {
            setAccounts(prev => prev.map(a => a.id === original.accountId ? { ...a, balance: a.balance - balanceDelta } : a));
        }
        
        if (_isRetry) {
          bufferError('Failed to retry updating transaction.');
          throw error;
        }
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'update',
          entity: 'transaction',
          data: { id, ...data, balanceDelta },
          timestamp: Date.now()
        }]);
        bufferError('Update failed. Added to pending updates.');
      }
  };

  const updateCategory = async (id: string, data: Partial<Category>, _isRetry?: boolean) => {
      if (!user) return;
      const originalMeta = metadata.find(c => c.id === id);
      const originalAlloc = allocations.find(a => a.categoryId === id && a.month === selectedMonth);
      if (!originalMeta) return;

      if (originalMeta.isRta && data.name) {
          addToast('Cannot rename the Ready to Assign category.', 'error');
          return;
      }

      // Optimistic
      if (data.budgeted !== undefined) {
        setAllocations(prev => {
          const exists = prev.find(a => a.categoryId === id && a.month === selectedMonth);
          if (exists) {
            return prev.map(a => (a.categoryId === id && a.month === selectedMonth) ? { ...a, budgeted: data.budgeted! } : a);
          }
          return [...prev, { id: `${selectedMonth}_${id}`, month: selectedMonth, categoryId: id, budgeted: data.budgeted! }];
        });
      }
      if (data.name || data.color || data.hex) {
        setMetadata(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      }

      try {
        const batch = writeBatch(db);
        if (data.name || data.color || data.hex || data.targetType !== undefined || data.targetAmount !== undefined || data.targetDate !== undefined) {
            const metaRef = doc(db, 'users', user.uid, 'categories', id);
            const metaUpdate: Partial<CategoryMetadata> = {};
            if (data.name) metaUpdate.name = data.name;
            if (data.color) metaUpdate.color = data.color;
            if (data.hex) metaUpdate.hex = data.hex;
            if (data.targetType !== undefined) metaUpdate.targetType = data.targetType;
            if (data.targetAmount !== undefined) metaUpdate.targetAmount = data.targetAmount;
            if (data.targetDate !== undefined) metaUpdate.targetDate = data.targetDate;
            batch.update(metaRef, metaUpdate);
        }

        if (data.budgeted !== undefined) {
            const allocId = `${selectedMonth}_${id}`;
            const allocRef = doc(db, 'users', user.uid, 'monthly_allocations', allocId);
            batch.set(allocRef, { 
                month: selectedMonth, 
                categoryId: id, 
                budgeted: data.budgeted 
            }, { merge: true });
        }

        await batch.commit();
      } catch (error) {
        console.error('Failed to update category:', error);
        // Rollback
        if (data.budgeted !== undefined) {
          setAllocations(prev => originalAlloc ? prev.map(a => a.id === originalAlloc.id ? originalAlloc : a) : prev.filter(a => a.categoryId !== id || a.month !== selectedMonth));
        }
        if (data.name || data.color || data.hex) {
          setMetadata(prev => prev.map(c => c.id === id ? originalMeta : c));
        }
        if (_isRetry) {
          bufferError('Failed to retry updating category.');
          throw error;
        }
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'update',
          entity: 'category',
          data: { id, ...data },
          timestamp: Date.now()
        }]);
        bufferError('Category update failed. Added to pending updates.');
      }
  };

  const addCategory = async (data: Omit<Category, 'id' | 'activity' | 'available' | 'spent'>, _isRetry?: boolean) => {
      if (!user) return;

      const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
      const catId = metaRef.id;
      const newMeta: CategoryMetadata = {
        id: catId,
        name: data.name,
        color: data.color,
        hex: data.hex,
        isRta: data.isRta || false,
        targetType: data.targetType,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate
      };
      const newAlloc: MonthlyAllocation = {
        id: `${selectedMonth}_${catId}`,
        month: selectedMonth,
        categoryId: catId,
        budgeted: data.budgeted || 0
      };

      setMetadata(prev => [...prev, newMeta]);
      setAllocations(prev => [...prev, newAlloc]);

      try {
        const batch = writeBatch(db);
        batch.set(metaRef, {
            name: data.name,
            color: data.color,
            hex: data.hex,
            isRta: data.isRta || false,
            targetType: data.targetType || null,
            targetAmount: data.targetAmount || null,
            targetDate: data.targetDate || null
        });

        const allocId = `${selectedMonth}_${catId}`;
        const allocRef = doc(db, 'users', user.uid, 'monthly_allocations', allocId);
        batch.set(allocRef, {
            month: selectedMonth,
            categoryId: catId,
            budgeted: data.budgeted || 0
        });

        await batch.commit();
      } catch (error) {
        console.error('Failed to add category:', error);
        setMetadata(prev => prev.filter(c => c.id !== catId));
        setAllocations(prev => prev.filter(a => a.categoryId !== catId));
        if (_isRetry) {
          bufferError('Failed to retry adding category.');
          throw error;
        }
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'add',
          entity: 'category',
          data,
          timestamp: Date.now()
        }]);
        bufferError('Failed to add category. Added to pending updates.');
      }
  };

  const deleteCategory = async (id: string, _isRetry?: boolean) => {
      if (!user) return;
      
      const originalMeta = metadata.find(c => c.id === id);
      const originalAllocs = allocations.filter(a => a.categoryId === id);
      if (!originalMeta) return;

      if (originalMeta.isRta) {
          addToast('Cannot delete the Ready to Assign category.', 'error');
          return;
      }

      const hasTransactions = allTransactions.some(t => t.category === originalMeta.name);
      if (hasTransactions) {
          addToast('Cannot delete category with associated transactions.', 'error');
          return;
      }

      setMetadata(prev => prev.filter(c => c.id !== id));
      setAllocations(prev => prev.filter(a => a.categoryId !== id));

      try {
        await deleteDoc(doc(db, 'users', user.uid, 'categories', id));
      } catch (error) {
        console.error('Failed to delete category:', error);
        setMetadata(prev => [...prev, originalMeta]);
        setAllocations(prev => [...prev, ...originalAllocs]);
        if (_isRetry) {
          bufferError('Failed to retry deleting category.');
          throw error;
        }
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'delete',
          entity: 'category',
          data: { id },
          timestamp: Date.now()
        }]);
        bufferError('Failed to delete category. Added to pending updates.');
      }
  };

  const retryMutation = async (mutationId: string) => {
    const mutation = pendingMutations.find(m => m.id === mutationId);
    if (!mutation || retryingIds.has(mutationId)) return;

    setRetryingIds(prev => {
      const next = new Set(prev);
      next.add(mutationId);
      return next;
    });

    try {
      if (mutation.entity === 'transaction') {
        if (mutation.type === 'add') {
          const { id, ...txData } = mutation.data as Omit<Transaction, 'id'> & { id: string };
          await addTransaction(txData, id, true);
        }
        if (mutation.type === 'update') {
          const { id, balanceDelta, ...updateData } = mutation.data as Partial<Transaction> & { id: string, balanceDelta?: number };
          await updateTransaction(id, updateData as Partial<Transaction>, balanceDelta, true);
        }
      } else if (mutation.entity === 'category') {
        if (mutation.type === 'add') {
          await addCategory(mutation.data as unknown as Omit<Category, 'id' | 'activity' | 'available' | 'spent'>, true);
        }
        if (mutation.type === 'update') {
          const { id, ...updateData } = mutation.data as Partial<Category> & { id: string };
          await updateCategory(id, updateData as Partial<Category>, true);
        }
        if (mutation.type === 'delete') {
          await deleteCategory(mutation.data.id as string, true);
        }
      }
      setPendingMutations(prev => prev.filter(m => m.id !== mutationId));
    } catch (error) {
      console.error('Retry failed:', error);
      bufferError('Retry failed. Please check your connection.');
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(mutationId);
        return next;
      });
    }
  };

  const seedData = async () => {
    if (!user) return;
    const batch = writeBatch(db);

    const accountsData = [
      { name: 'Main Checking', type: 'Checking', balance: 3200 },
      { name: 'Savings', type: 'Savings', balance: 15000 },
      { name: 'Credit Card', type: 'Credit Card', balance: -450 }
    ];

    for (const acc of accountsData) {
        const ref = doc(collection(db, 'users', user.uid, 'accounts'));
        batch.set(ref, acc);
    }

    const categoriesData = [
      { name: 'Ready to Assign', budgeted: 0, color: 'bg-slate-500', hex: '#64748b', isRta: true },
      { name: 'Rent / Mortgage', budgeted: 1500, color: 'bg-blue-500', hex: '#3b82f6' },
      { name: 'Electric', budgeted: 120, color: 'bg-yellow-500', hex: '#eab308' },
      { name: 'Internet', budgeted: 80, color: 'bg-indigo-500', hex: '#6366f1' },
      { name: 'Auto Insurance', budgeted: 100, color: 'bg-pink-500', hex: '#ec4899' },
      { name: 'Dining Out', budgeted: 300, color: 'bg-orange-500', hex: '#f97316' },
      { name: 'Emergency Fund', budgeted: 500, color: 'bg-emerald-500', hex: '#10b981' },
    ];

    for (const cat of categoriesData) {
        const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
        batch.set(metaRef, {
            name: cat.name,
            color: cat.color,
            hex: cat.hex,
            isRta: cat.isRta || false
        });

        const allocId = `${selectedMonth}_${metaRef.id}`;
        const allocRef = doc(db, 'users', user.uid, 'monthly_allocations', allocId);
        batch.set(allocRef, {
            month: selectedMonth,
            categoryId: metaRef.id,
            budgeted: cat.budgeted
        });
    }

    await batch.commit();
  };

  const reconcileAccount = async (accountId: string) => {
      if (!user) return;
      const q = query(
          collection(db, 'users', user.uid, 'transactions'),
          where('accountId', '==', accountId),
          where('status', '==', 'cleared')
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
          batch.update(d.ref, { status: 'reconciled' });
      });
      await batch.commit();
  };

  return {
    accounts,
    categories,
    transactions,
    loading,
    hasPendingWrites,
    isSyncing,
    isOnline,
    pendingMutations,
    addTransaction,
    updateTransaction,
    updateCategory,
    addCategory,
    deleteCategory,
    reconcileAccount,
    seedData,
    retryMutation,
    toasts,
    retryingIds
  };
}
