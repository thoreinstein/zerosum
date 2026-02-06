import { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc,
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

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  category: string;
  amount: number;
  status: 'cleared' | 'reconciled' | 'uncleared';
  accountId: string;
}

export function useFinanceData() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qAccounts = query(collection(db, 'users', user.uid, 'accounts'));
    const qCategories = query(collection(db, 'users', user.uid, 'categories'));
    const qTransactions = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });

    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubTransactions();
    };
  }, [user]);

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
            const catRef = doc(db, 'users', user.uid, 'categories', cat.id);
            batch.update(catRef, { spent: increment(Math.abs(txData.amount)) });
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
      await updateDoc(doc(db, 'users', user.uid, 'categories', id), data);
  };

  const addCategory = async (data: Omit<Category, 'id'>) => {
      if (!user) return;
      await addDoc(collection(db, 'users', user.uid, 'categories'), data);
  };

  const deleteCategory = async (id: string) => {
      if (!user) return;
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

      const accIds: Record<string, string> = {};

      for (const acc of accountsData) {
          const ref = doc(collection(db, 'users', user.uid, 'accounts'));
          batch.set(ref, acc);
          if (acc.name === 'Main Checking') accIds['acc1'] = ref.id;
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
          const ref = doc(collection(db, 'users', user.uid, 'categories'));
          batch.set(ref, cat);
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
