import { Transaction } from '@/hooks/useFinanceData';
import { ArrowLeft, CheckCheck, Lock, FileText, CloudSync } from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  selectedAccountId: string | null;
  onClearSelection: () => void;
  onReconcile: () => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
}

export default function TransactionsView({ transactions, selectedAccountId, onClearSelection, onReconcile, onToggleStatus }: TransactionsViewProps) {

  return (
    <div className="space-y-4">
      {selectedAccountId && (
        <div className="flex gap-2 mb-4">
          <button onClick={onReconcile} className="flex-1 bg-slate-900 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer">
            <CheckCheck size={18} /> Reconcile
          </button>
          <button onClick={onClearSelection} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <ArrowLeft size={24} />
          </button>
        </div>
      )}

      {transactions.map(tx => (
        <div
          key={tx.id}
          onClick={() => onToggleStatus(tx.id, tx.status)}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${tx.status === 'reconciled' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              {tx.isPending ? <CloudSync size={20} className="text-blue-500 animate-pulse" /> : tx.status === 'reconciled' ? <Lock size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{tx.payee}</p>
              <p className="text-[10px] text-slate-400">{tx.date} • {tx.category}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-bold ${tx.amount < 0 ? 'text-slate-800 dark:text-slate-200' : 'text-emerald-500'}`}>
              {tx.amount < 0 ? '' : '+'}${Math.abs(tx.amount).toLocaleString()}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className={`w-2 h-2 rounded-full ${tx.status === 'reconciled' ? 'bg-emerald-500' : tx.status === 'cleared' ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
              <span className="text-[8px] uppercase font-bold text-slate-300">{tx.status}</span>
            </div>
          </div>
        </div>
      ))}

      {transactions.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <p>No transactions found.</p>
        </div>
      )}
    </div>
  );
}
