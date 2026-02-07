import { usePaginatedTransactions, TransactionFilters } from '@/hooks/usePaginatedTransactions';
import TransactionFilterBar from './TransactionFilterBar';
import { useFinance } from '@/context/FinanceContext';
import { ArrowLeft, CheckCheck, Lock, FileText, Loader2, CloudSync, AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TransactionsViewProps {
  selectedAccountId: string | null;
  onClearSelection: () => void;
  onReconcile: () => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
}

export default function TransactionsView({ selectedAccountId, onClearSelection, onReconcile, onToggleStatus }: TransactionsViewProps) {
  const { refreshTransactions } = useFinance();
  const [filters, setFilters] = useState<TransactionFilters>({ accountId: selectedAccountId, status: 'all' });

  // Sync accountId filter with prop
  useEffect(() => {
    setFilters(prev => ({ ...prev, accountId: selectedAccountId }));
  }, [selectedAccountId]);

  const { transactions, loading, loadingMore, hasMore, error, fetchNextPage, refresh } = usePaginatedTransactions(filters);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    await onToggleStatus(id, currentStatus);
    refreshTransactions();
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !error) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, error, fetchNextPage]);

  if (loading && transactions.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <TransactionFilterBar filters={filters} setFilters={setFilters} />

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
          onClick={() => handleToggleStatus(tx.id, tx.status)}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${tx.status === 'reconciled' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              {tx.isPending ? <CloudSync size={20} className="text-blue-500 animate-pulse" /> : tx.status === 'reconciled' ? <Lock size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{tx.payee}</p>
              <p className="text-[10px] text-slate-400">
                {tx.date} • {tx.category}
                {tx.scanStatus === 'pending' && <span className="ml-2 text-amber-500 font-bold uppercase text-[8px]">Queued for Scan</span>}
                {tx.scanStatus === 'scanning' && <span className="ml-2 text-blue-500 font-bold uppercase text-[8px]">Scanning...</span>}
                {tx.scanStatus === 'failed' && <span className="ml-2 text-red-500 font-bold uppercase text-[8px]">Scan Failed</span>}
              </p>
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

      {transactions.length === 0 && !loading && (
        <div className="text-center py-10 text-slate-400">
          <p>No transactions found.</p>
        </div>
      )}

      {/* Pagination Sentinel */}
      <div ref={observerTarget} className="h-4 w-full" />

      {loadingMore && (
        <div className="flex flex-col items-center justify-center py-4 gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={20} />
          <p className="text-xs font-medium">Loading more...</p>
        </div>
      )}

      {!hasMore && transactions.length > 0 && !error && (
        <div className="text-center py-6 border-t border-slate-100 dark:border-slate-800 mt-4">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">End of transactions</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl mt-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle size={20} />
            <p className="text-sm font-bold">Failed to load transactions</p>
          </div>
          <button 
            onClick={() => refresh()}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}