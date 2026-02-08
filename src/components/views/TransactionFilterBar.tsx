'use client';

import { TransactionFilters } from '@/hooks/usePaginatedTransactions';
import { Filter, Calendar, X, Search } from 'lucide-react';
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  setFilters: Dispatch<SetStateAction<TransactionFilters>>;
}

export default function TransactionFilterBar({ filters, setFilters }: TransactionFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '');
  const [prevSearchQuery, setPrevSearchQuery] = useState(filters.searchQuery);

  if (filters.searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(filters.searchQuery);
    setLocalSearch(filters.searchQuery || '');
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      // Only update if the debounced value is different from the prop to avoid loops
      if (localSearch !== filters.searchQuery) {
          setFilters(prev => ({ ...prev, searchQuery: localSearch }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, setFilters, filters.searchQuery]);

  const handleStatusChange = (status: TransactionFilters['status']) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const clearFilters = () => {
    setLocalSearch('');
    setFilters(prev => ({ accountId: prev.accountId, status: 'all' }));
  };

  const hasActiveFilters = !!(filters.status && filters.status !== 'all') || !!filters.startDate || !!filters.endDate || !!filters.searchQuery;

  return (
    <div className="flex flex-col gap-3 mb-6 p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Filters</span>
        </div>
        {hasActiveFilters && (
          <button 
            onClick={clearFilters}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors"
          >
            <X size={12} /> Clear All
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Search payees..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        {localSearch && (
          <button 
            onClick={() => setLocalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'cleared', 'uncleared', 'reconciled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`
              px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all
              ${(filters.status || 'all') === s 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' 
                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-100 dark:border-slate-700'}
            `}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="date" 
            value={filters.startDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <span className="text-slate-300 text-xs">to</span>
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="date" 
            value={filters.endDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
