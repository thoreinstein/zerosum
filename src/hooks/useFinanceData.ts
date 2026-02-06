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
  spent: number;
  color: string;
  hex: string;
}

export interface CategoryMetadata {
  id: string;
  name: string;
  color: string;
  hex: string;
}

export interface MonthlyAllocation {
  id: string;
  budgeted: number;
  spent: number;
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
    const qMonthly = query(collection(db, 'users', user.uid, 'monthly_budgets', selectedMonth, 'categories'));
    const qTransactions = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));

    let metadata: CategoryMetadata[] = [];
    let allocations: Record<string, MonthlyAllocation> = {};

    const updateMergedCategories = () => {
      const merged = metadata.map(m => {
        const alloc = allocations[m.id];
        return {
          ...m,
          budgeted: alloc?.budgeted || 0,
          spent: alloc?.spent || 0
        } as Category;
      });
      setCategories(merged);
    };

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });

    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      metadata = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CategoryMetadata));
      updateMergedCategories();
    });

    const unsubMonthly = onSnapshot(qMonthly, (snapshot) => {
      allocations = {};
      snapshot.docs.forEach(d => {
        allocations[d.id] = { id: d.id, ...d.data() } as MonthlyAllocation;
      });
      updateMergedCategories();
    });

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
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

    const batch = writeBatch(db);
    const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
    batch.set(txRef, txData);

    const accRef = doc(db, 'users', user.uid, 'accounts', txData.accountId);
    batch.update(accRef, { balance: increment(txData.amount) });

    if (txData.amount < 0 && txData.category !== 'Inflow') {
        const cat = categories.find(c => c.name === txData.category);
        if (cat) {
            const txMonth = txData.date.slice(0, 7);
            const catAllocRef = doc(db, 'users', user.uid, 'monthly_budgets', txMonth, 'categories', cat.id);
            batch.set(catAllocRef, { spent: increment(Math.abs(txData.amount)) }, { merge: true });
        }
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
      
      // Update metadata if name/color changed
      if (data.name || data.color || data.hex) {
          const metaRef = doc(db, 'users', user.uid, 'categories', id);
          const metaUpdate: Partial<CategoryMetadata> = {};
          if (data.name) metaUpdate.name = data.name;
          if (data.color) metaUpdate.color = data.color;
          if (data.hex) metaUpdate.hex = data.hex;
          batch.update(metaRef, metaUpdate);
      }

      // Update monthly allocation if budgeted changed
      if (data.budgeted !== undefined) {
          const allocRef = doc(db, 'users', user.uid, 'monthly_budgets', selectedMonth, 'categories', id);
          batch.set(allocRef, { budgeted: data.budgeted }, { merge: true });
      }

      await batch.commit();
  };

  const addCategory = async (data: Omit<Category, 'id'>) => {
      if (!user) return;
      const batch = writeBatch(db);
      
      const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
      const metadata = {
          name: data.name,
          color: data.color,
          hex: data.hex
      };
      batch.set(metaRef, metadata);

      const allocRef = doc(db, 'users', user.uid, 'monthly_budgets', selectedMonth, 'categories', metaRef.id);
      batch.set(allocRef, {
          budgeted: data.budgeted,
          spent: data.spent
      });

      await batch.commit();
  };

  const deleteCategory = async (id: string) => {
      if (!user) return;
      
      const cat = categories.find(c => c.id === id);
      if (!cat) return;

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
        { name: 'Rent / Mortgage', budgeted: 1500, spent: 1500, color: 'bg-blue-500', hex: '#3b82f6' },
        { name: 'Electric', budgeted: 120, spent: 110, color: 'bg-yellow-500', hex: '#eab308' },
        { name: 'Internet', budgeted: 80, spent: 80, color: 'bg-indigo-500', hex: '#6366f1' },
        { name: 'Auto Insurance', budgeted: 100, spent: 0, color: 'bg-pink-500', hex: '#ec4899' },
        { name: 'Dining Out', budgeted: 300, spent: 245, color: 'bg-orange-500', hex: '#f97316' },
        { name: 'Emergency Fund', budgeted: 500, spent: 0, color: 'bg-emerald-500', hex: '#10b981' },
      ];

      for (const cat of categoriesData) {
          const metaRef = doc(collection(db, 'users', user.uid, 'categories'));
          batch.set(metaRef, {
              name: cat.name,
              color: cat.color,
              hex: cat.hex
          });

          const allocRef = doc(db, 'users', user.uid, 'monthly_budgets', selectedMonth, 'categories', metaRef.id);
          batch.set(allocRef, {
              budgeted: cat.budgeted,
              spent: cat.spent
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
