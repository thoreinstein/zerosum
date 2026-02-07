import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  collection, query, onSnapshot, updateDoc, doc, deleteDoc,
  orderBy, writeBatch, increment, where, getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

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
  spent: number; // For backward compatibility if needed, but will map to activity
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

export function useFinanceData(selectedMonth: string = new Date().toISOString().slice(0, 7)) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoriesMetadata, setCategoriesMetadata] = useState<CategoryMetadata[]>([]);
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [allocationsData, setAllocationsData] = useState<MonthlyAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<Record<string, boolean>>({
    accounts: false,
    categories: false,
    monthly: false,
    transactions: false
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const hasPendingWrites = useMemo(() => Object.values(syncStatus).some(v => v), [syncStatus]);

  // Optimistic Categories & Transactions
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const qAccounts = query(collection(db, 'users', user.uid, 'accounts'));
    const qCategories = query(collection(db, 'users', user.uid, 'categories'));
    const qMonthly = query(collection(db, 'users', user.uid, 'monthly_allocations'));
    const qTransactions = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));

    const unsubAccounts = onSnapshot(qAccounts, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      setAccounts(data);
      setSyncStatus(prev => ({ ...prev, accounts: snapshot.metadata.hasPendingWrites }));
    });

    const unsubCategories = onSnapshot(qCategories, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CategoryMetadata));
      setCategoriesMetadata(data);
      setSyncStatus(prev => ({ ...prev, categories: snapshot.metadata.hasPendingWrites }));
    });

    const unsubMonthly = onSnapshot(qMonthly, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAllocation));
      setAllocationsData(data);
      setSyncStatus(prev => ({ ...prev, monthly: snapshot.metadata.hasPendingWrites }));
    });

    const unsubTransactions = onSnapshot(qTransactions, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        isPending: d.metadata.hasPendingWrites
      } as Transaction));
      setTransactionsData(data);
      setSyncStatus(prev => ({ ...prev, transactions: snapshot.metadata.hasPendingWrites }));
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubMonthly();
      unsubTransactions();
    };
  }, [user]);

  useEffect(() => {
    if (categoriesMetadata.length === 0) return;

    // 1. Group transactions by month and category
    const activityMap: Record<string, Record<string, number>> = {};
    transactionsData.forEach(tx => {
      const month = tx.date.slice(0, 7);
      if (!activityMap[month]) activityMap[month] = {};
      if (!activityMap[month][tx.category]) activityMap[month][tx.category] = 0;
      activityMap[month][tx.category] += tx.amount;
    });

    // 2. Group allocations by month and category
    const budgetMap: Record<string, Record<string, number>> = {};
    allocationsData.forEach(alloc => {
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
      
      categoriesMetadata.forEach(cat => {
        if (cat.isRta || cat.isCcPayment) return;
        const budgeted = budgetMap[m]?.[cat.id] || 0;
        const activity = activityMap[m]?.[cat.name] || 0;
        const prevAvailable = runningAvailable[cat.id] || 0;
        
        const available = prevAvailable + budgeted + activity;
        monthResults[m][cat.id] = { budgeted, activity, available };
        totalBudgetedToCategories += budgeted;
      });

      const ccTransactions = transactionsData.filter(tx => {
          const month = tx.date.slice(0, 7);
          const acc = accounts.find(a => a.id === tx.accountId);
          return month === m && acc?.type === 'Credit Card' && tx.amount < 0;
      });

      ccTransactions.forEach(tx => {
          const catMeta = categoriesMetadata.find(c => c.name === tx.category);
          const ccPaymentMeta = categoriesMetadata.find(c => c.isCcPayment && c.linkedAccountId === tx.accountId);
          
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

      categoriesMetadata.forEach(cat => {
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

      const rtaMetadata = categoriesMetadata.find(c => c.isRta);
      if (rtaMetadata) {
          const income = activityMap[m]?.[rtaMetadata.name] || 0;
          const prevRta = runningAvailable[rtaMetadata.id] || 0;
          const available = prevRta + income - totalBudgetedToCategories;
          runningAvailable[rtaMetadata.id] = available;
          monthResults[m][rtaMetadata.id] = { budgeted: 0, activity: income, available };
      }
    });

    const merged = categoriesMetadata.map(m => {
      const stats = monthResults[selectedMonth]?.[m.id] || { budgeted: 0, activity: 0, available: 0 };
      return {
        ...m,
        budgeted: stats.budgeted,
        activity: stats.activity,
        available: stats.available,
        spent: Math.abs(stats.activity)
      } as Category;
    });

    setCategories(merged);
    setTransactions(transactionsData);
  }, [categoriesMetadata, transactionsData, allocationsData, accounts, selectedMonth]);

  const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>([]);
  const isInitialized = useRef(false);

  // Load pending mutations from localStorage on init
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('zerosum_pending_mutations');
      if (saved) {
        setPendingMutations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load pending mutations from localStorage:', error);
    } finally {
      isInitialized.current = true;
    }
  }, []);

  // Sync pending mutations to localStorage
  useEffect(() => {
    if (!isInitialized.current || typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('zerosum_pending_mutations', JSON.stringify(pendingMutations));
    } catch (error) {
      console.error('Failed to save pending mutations to localStorage:', error);
    }
  }, [pendingMutations]);

  const addTransaction = async (txData: Omit<Transaction, 'id'>, id?: string) => {
    if (!user) return;
    
    // Client-side ID generation for Firestore write
    const txRef = id ? doc(db, 'users', user.uid, 'transactions', id) : doc(collection(db, 'users', user.uid, 'transactions'));

    // We rely on Firestore's native latency compensation (local cache)
    // for the optimistic update of the 'transactionsData' via onSnapshot.
    
    try {
      const accRef = doc(db, 'users', user.uid, 'accounts', txData.accountId);
      const batch = writeBatch(db);
      batch.set(txRef, txData);
      batch.update(accRef, { balance: increment(txData.amount) });

      // Handle Transfer Logic for CC Payments
      const ccPaymentCategory = categories.find(c => c.name === txData.category && c.isCcPayment);
      if (ccPaymentCategory?.linkedAccountId) {
          const linkedAccRef = doc(db, 'users', user.uid, 'accounts', ccPaymentCategory.linkedAccountId);
          batch.update(linkedAccRef, { balance: increment(Math.abs(txData.amount)) });
      }

      await batch.commit();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      // Even with latency compensation, we add to pending for retry if the write fails globally.
      setPendingMutations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'add',
        entity: 'transaction',
        data: txData,
        timestamp: Date.now()
      }]);
    }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
      if (!user) return;
      
      const original = transactionsData.find(t => t.id === id);
      if (!original) return;

      // Optimistic Update
      setTransactionsData(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

      try {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', id), data);
      } catch (error) {
        console.error('Failed to update transaction:', error);
        // Rollback
        setTransactionsData(prev => prev.map(t => t.id === id ? original : t));
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'update',
          entity: 'transaction',
          data: { id, ...data },
          timestamp: Date.now()
        }]);
      }
  };

  const updateCategory = async (id: string, data: Partial<Category>) => {
      if (!user) return;
      
      const originalMeta = categoriesMetadata.find(c => c.id === id);
      const originalAlloc = allocationsData.find(a => a.categoryId === id && a.month === selectedMonth);
      if (!originalMeta) return;

      // Optimistic Update
      if (data.budgeted !== undefined) {
        setAllocationsData(prev => {
          const exists = prev.find(a => a.categoryId === id && a.month === selectedMonth);
          if (exists) {
            return prev.map(a => (a.categoryId === id && a.month === selectedMonth) ? { ...a, budgeted: data.budgeted! } : a);
          }
          return [...prev, { id: `${selectedMonth}_${id}`, month: selectedMonth, categoryId: id, budgeted: data.budgeted! }];
        });
      }
      if (data.name || data.color || data.hex) {
        setCategoriesMetadata(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      }

      try {
        const batch = writeBatch(db);
        
        // Update metadata if name/color/targets changed
        if (data.name || data.color || data.hex || data.targetType !== undefined || data.targetAmount !== undefined || data.targetDate !== undefined) {
            if (originalMeta.isRta && data.name) {
                throw new Error('Cannot rename the Ready to Assign category.');
            }
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
          setAllocationsData(prev => originalAlloc ? prev.map(a => a.id === originalAlloc.id ? originalAlloc : a) : prev.filter(a => a.categoryId !== id || a.month !== selectedMonth));
        }
        if (data.name || data.color || data.hex) {
          setCategoriesMetadata(prev => prev.map(c => c.id === id ? originalMeta : c));
        }
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'update',
          entity: 'category',
          data: { id, ...data },
          timestamp: Date.now()
        }]);
      }
  };

  const addCategory = async (data: Omit<Category, 'id' | 'activity' | 'available' | 'spent'>) => {
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

      // Optimistic Update
      setCategoriesMetadata(prev => [...prev, newMeta]);
      setAllocationsData(prev => [...prev, newAlloc]);

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
        // Rollback
        setCategoriesMetadata(prev => prev.filter(c => c.id !== catId));
        setAllocationsData(prev => prev.filter(a => a.categoryId !== catId));
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'add',
          entity: 'category',
          data,
          timestamp: Date.now()
        }]);
      }
  };

  const deleteCategory = async (id: string) => {
      if (!user) return;
      
      const originalMeta = categoriesMetadata.find(c => c.id === id);
      const originalAllocs = allocationsData.filter(a => a.categoryId === id);
      if (!originalMeta) return;

      if (originalMeta.isRta) {
          addToast('Cannot delete the Ready to Assign category.', 'error');
          return;
      }

      const hasTransactions = transactionsData.some(t => t.category === originalMeta.name);
      if (hasTransactions) {
          addToast('Cannot delete category with associated transactions. Please re-categorize transactions first.', 'error');
          return;
      }

      // Optimistic Update
      setCategoriesMetadata(prev => prev.filter(c => c.id !== id));
      setAllocationsData(prev => prev.filter(a => a.categoryId !== id));

      try {
        await deleteDoc(doc(db, 'users', user.uid, 'categories', id));
      } catch (error) {
        console.error('Failed to delete category:', error);
        // Rollback
        setCategoriesMetadata(prev => [...prev, originalMeta]);
        setAllocationsData(prev => [...prev, ...originalAllocs]);
        setPendingMutations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'delete',
          entity: 'category',
          data: { id },
          timestamp: Date.now()
        }]);
      }
  };

  const retryMutation = async (mutationId: string) => {
    const mutation = pendingMutations.find(m => m.id === mutationId);
    if (!mutation || retryingIds.has(mutationId)) return;

    // Set loading state
    setRetryingIds(prev => {
      const next = new Set(prev);
      next.add(mutationId);
      return next;
    });

    try {
      if (mutation.entity === 'transaction') {
        if (mutation.type === 'add') {
          await addTransaction(mutation.data as unknown as Omit<Transaction, 'id'>);
        }
        if (mutation.type === 'update') {
          const { id, ...updateData } = mutation.data as Partial<Transaction> & { id: string };
          await updateTransaction(id, updateData as Partial<Transaction>);
        }
      } else if (mutation.entity === 'category') {
        if (mutation.type === 'add') {
          await addCategory(mutation.data as unknown as Omit<Category, 'id' | 'activity' | 'available' | 'spent'>);
        }
        if (mutation.type === 'update') {
          const { id, ...updateData } = mutation.data as Partial<Category> & { id: string };
          await updateCategory(id, updateData as Partial<Category>);
        }
        if (mutation.type === 'delete') {
          await deleteCategory(mutation.data.id as string);
        }
      }
      
      // If success, remove from pending
      setPendingMutations(prev => prev.filter(m => m.id !== mutationId));
    } catch (error) {
      console.error('Retry failed:', error);
      addToast('Retry failed. Please check your connection.', 'error');
    } finally {
      // Clear loading state
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
