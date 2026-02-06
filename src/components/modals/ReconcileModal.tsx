import { useState } from 'react';
import { Account } from '@/hooks/useFinanceData';

interface ReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinish: () => void;
  account: Account;
}

export default function ReconcileModal({ isOpen, onClose, onFinish, account }: ReconcileModalProps) {
  const [statementBalance, setStatementBalance] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reconcile Account</h2>
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-slate-400">Statement Balance</label>
          <input
            type="number"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-2xl font-bold border-none text-slate-900 dark:text-slate-100"
            placeholder="0.00"
          />
        </div>
        <div className="flex justify-between items-center py-4 border-y border-slate-100 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-400">Cleared Balance</p>
          <p className="font-bold text-slate-900 dark:text-slate-100">${account.balance.toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 p-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={onFinish} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-500/20">Finish</button>
        </div>
      </div>
    </div>
  );
}
