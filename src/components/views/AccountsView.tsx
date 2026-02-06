import { Account } from '@/hooks/useFinanceData';
import { Landmark } from 'lucide-react';

interface AccountsViewProps {
  accounts: Account[];
  setSelectedAccountId: (id: string | null) => void;
}

export default function AccountsView({ accounts, setSelectedAccountId }: AccountsViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => setSelectedAccountId(acc.id)}
          className="glass-card p-6 rounded-2xl text-left hover:border-blue-500/50 transition-all group cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
              <Landmark size={24} />
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{acc.type}</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{acc.name}</h3>
          <p className={`text-2xl font-bold mt-1 ${acc.balance < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
            ${acc.balance.toLocaleString()}
          </p>
        </button>
      ))}
    </div>
  );
}
