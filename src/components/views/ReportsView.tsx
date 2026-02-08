import React, { useMemo } from 'react';
import { Transaction, Category } from '@/hooks/useFinanceData';

interface ReportsViewProps {
  transactions: Transaction[];
  categories: Category[];
  totalSpent: number;
  selectedMonth: string;
}

export default function ReportsView({ transactions, categories, totalSpent, selectedMonth }: ReportsViewProps) {
  const reportData = useMemo(() => {
    // Robustness: ensure we only report on the intended month
    const windowedTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
    
    const income = windowedTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = Math.abs(windowedTransactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const categorySpending = categories.map(cat => ({
      name: cat.name,
      amount: cat.spent,
      color: cat.hex,
      percent: totalSpent > 0 ? (cat.spent / totalSpent) * 100 : 0
    })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

    return { income, expenses, savingsRate, categorySpending };
  }, [transactions, categories, totalSpent, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Monthly Income</p>
          <p className="text-xl font-bold text-emerald-500">${reportData.income.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Monthly Expenses</p>
          <p className="text-xl font-bold text-red-500">${reportData.expenses.toLocaleString()}</p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-[2rem]">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">Spending Breakdown</h3>
            <p className="text-xs text-slate-500 font-medium">Top categories this month</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-blue-600">{reportData.savingsRate.toFixed(0)}%</p>
            <p className="text-[8px] uppercase font-bold text-slate-400">Savings Rate</p>
          </div>
        </div>

        <div className="flex items-center gap-8 mb-8">
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {reportData.categorySpending.reduce<React.ReactNode[]>((acc, cat, i) => {
                const prevSum = reportData.categorySpending.slice(0, i).reduce((s, c) => s + c.percent, 0);
                const dashArray = `${cat.percent} 100`;
                const dashOffset = -prevSum;
                acc.push(
                  <circle
                    key={cat.name}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth="12"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-700"
                  />
                );
                return acc;
              }, [])}
              <circle cx="50" cy="50" r="34" className="fill-white dark:fill-slate-900" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">${reportData.expenses.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {reportData.categorySpending.slice(0, 4).map(cat => (
              <div key={cat.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="font-medium text-slate-500">{cat.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">${cat.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
