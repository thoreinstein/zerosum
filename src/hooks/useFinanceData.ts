import { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, updateDoc, doc, deleteDoc,
  orderBy, writeBatch, increment, where, getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

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
}

export function useFinanceData(selectedMonth: string = new Date().toISOString().slice(0, 7)) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

    let currentAccounts: Account[] = [];
    let metadata: CategoryMetadata[] = [];
    let allAllocations: MonthlyAllocation[] = [];
    let allTransactions: Transaction[] = [];

    const calculateFinances = () => {
      if (metadata.length === 0) return;

      // 1. Group transactions by month and category
      const activityMap: Record<string, Record<string, number>> = {};
      allTransactions.forEach(tx => {
        const month = tx.date.slice(0, 7);
        if (!activityMap[month]) activityMap[month] = {};
        if (!activityMap[month][tx.category]) activityMap[month][tx.category] = 0;
        activityMap[month][tx.category] += tx.amount;
      });

      // 2. Group allocations by month and category
      const budgetMap: Record<string, Record<string, number>> = {};
      allAllocations.forEach(alloc => {
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

        const ccTransactions = allTransactions.filter(tx => {
            const month = tx.date.slice(0, 7);
            const acc = currentAccounts.find(a => a.id === tx.accountId);
            return month === m && acc?.type === 'Credit Card' && tx.amount < 0;
        });

        ccTransactions.forEach(tx => {
            const catMeta = metadata.find(c => c.name === tx.category);
            const ccPaymentMeta = metadata.find(c => c.isCcPayment && c.linkedAccountId === tx.accountId);
            
            if (catMeta && ccPaymentMeta && !catMeta.isRta) {
                const currentAvailable = monthResults[m][catMeta.id].available;
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
            runningAvailable[cat.id] = monthResults[m][cat.id].available;
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

      const merged = metadata.map(m => {
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
    };

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      currentAccounts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      setAccounts(currentAccounts);

      currentAccounts.filter(a => a.type === 'Credit Card').forEach(async (ccAcc) => {
          if (metadata.length > 0 && !metadata.find(m => m.linkedAccountId === ccAcc.id)) {
              const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
              const batch = writeBatch(db);
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
              await batch.commit();
          }
      });
      calculateFinances();
    });

    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      metadata = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CategoryMetadata));
      calculateFinances();
    });

    const unsubMonthly = onSnapshot(qMonthly, (snapshot) => {
      allAllocations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAllocation));
      calculateFinances();
    });

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      allTransactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(allTransactions);
      calculateFinances();
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubMonthly();
      unsubTransactions();
    };
  }, [user, selectedMonth]);

  const addTransaction = async (txData: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
    const accRef = doc(db, 'users', user.uid, 'accounts', txData.accountId);
    
    const batch = writeBatch(db);
    batch.set(txRef, txData);
    batch.update(accRef, { balance: increment(txData.amount) });

    // Handle Transfer Logic for CC Payments
    const ccPaymentCategory = categories.find(c => c.name === txData.category && c.isCcPayment);
    if (ccPaymentCategory?.linkedAccountId) {
        const linkedAccRef = doc(db, 'users', user.uid, 'accounts', ccPaymentCategory.linkedAccountId);
        // If we are paying the CC from checking, amount is negative in checking, 
        // so we add the absolute value to the CC balance (bringing it closer to zero).
        batch.update(linkedAccRef, { balance: increment(Math.abs(txData.amount)) });
    }

    await batch.commit();
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid, 'transactions', id), data);
  };

  const updateCategory = async (id: string, data: Partial<Category>) => {
      if (!user) return;
      const batch = writeBatch(db);
      
      const cat = categories.find(c => c.id === id);
      if (!cat) return;

      // Update metadata if name/color/targets changed
      if (data.name || data.color || data.hex || data.targetType !== undefined || data.targetAmount !== undefined || data.targetDate !== undefined) {
          if (cat.isRta && data.name) {
              alert('Cannot rename the Ready to Assign category.');
              return;
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
  };

  const addCategory = async (data: Omit<Category, 'id' | 'activity' | 'available' | 'spent'>) => {
      if (!user) return;
      const batch = writeBatch(db);
      
      const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
      batch.set(metaRef, {
          name: data.name,
          color: data.color,
          hex: data.hex,
          isRta: data.isRta || false,
          targetType: data.targetType || null,
          targetAmount: data.targetAmount || null,
          targetDate: data.targetDate || null
      });

      const allocId = `${selectedMonth}_${metaRef.id}`;
      const allocRef = doc(db, 'users', user.uid, 'monthly_allocations', allocId);
      batch.set(allocRef, {
          month: selectedMonth,
          categoryId: metaRef.id,
          budgeted: data.budgeted || 0
      });

      await batch.commit();
  };

  const deleteCategory = async (id: string) => {
      if (!user) return;
      
      const cat = categories.find(c => c.id === id);
      if (!cat) return;

      if (cat.isRta) {
          alert('Cannot delete the Ready to Assign category.');
          return;
      }

      const hasTransactions = transactions.some(t => t.category === cat.name);
      if (hasTransactions) {
          alert('Cannot delete category with associated transactions. Please re-categorize transactions first.');
          return;
      }

      await deleteDoc(doc(db, 'users', user.uid, 'categories', id));
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

  return {
    accounts,
    categories,
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    updateCategory,
    addCategory,
    deleteCategory,
    reconcileAccount,
    seedData
  };
}
