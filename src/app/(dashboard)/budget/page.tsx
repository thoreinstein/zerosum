'use client';

import { useMemo } from 'react';
import { useDashboardData } from '@/context/DashboardContext';
import BudgetView from '@/components/views/BudgetView';

export default function BudgetPage() {
  const { 
    categories, 
    accounts, 
    updateCategory, 
    deleteCategory, 
    addCategory 
  } = useDashboardData();

  const totalBudgeted = useMemo(() => 
    categories.filter(c => !c.isRta).reduce((sum, cat) => sum + cat.budgeted, 0), 
  [categories]);

  const totalSpent = useMemo(() => 
    categories.filter(c => !c.isRta).reduce((sum, cat) => sum + Math.abs(cat.activity), 0), 
  [categories]);

  return (
    <BudgetView
      categories={categories}
      accounts={accounts}
      totalBudgeted={totalBudgeted}
      totalSpent={totalSpent}
      updateCategory={updateCategory}
      deleteCategory={deleteCategory}
      addCategory={addCategory}
    />
  );
}
