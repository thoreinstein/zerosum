'use client';

import { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useDashboardData } from '@/context/DashboardContext';
import ReportsView from '@/components/views/ReportsView';

export default function ReportsPage() {
  const { selectedMonth } = useFinance();
  const { transactions, categories } = useDashboardData();

  const totalSpent = useMemo(() => 
    categories.filter(c => !c.isRta).reduce((sum, cat) => sum + Math.abs(cat.activity), 0), 
  [categories]);

  return (
    <ReportsView 
      transactions={transactions} 
      categories={categories} 
      totalSpent={totalSpent} 
      selectedMonth={selectedMonth}
    />
  );
}
