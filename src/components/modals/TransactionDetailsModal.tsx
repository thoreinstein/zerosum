import { useState } from 'react';
import { Transaction, Account, Category } from '@/hooks/useFinanceData';
import { X, Calendar, User, DollarSign, Folder, CreditCard, CheckCircle, Link as LinkIcon } from 'lucide-react';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onSave: (id: string, data: Partial<Transaction>, balanceDelta?: number) => void;
  showToast?: (message: string) => void;
}

export default function TransactionDetailsModal({ 
  isOpen, 
  onClose, 
  transaction, 
  accounts, 
  categories, 
  onSave,
  showToast
}: TransactionDetailsModalProps) {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: transaction.date,
    payee: transaction.payee,
    amount: transaction.amount,
    category: transaction.category,
    accountId: transaction.accountId,
    status: transaction.status,
  });

  const [amountInput, setAmountInput] = useState(String(transaction.amount));

  const handleSave = () => {
    if (!transaction) return;
    
    const parsedAmount = parseFloat(amountInput) || 0;
    const finalData = { ...formData, amount: parsedAmount };

    onSave(transaction.id, finalData);
    onClose();
  };

  const copyLink = () => {
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('txId', transaction.id);
        navigator.clipboard.writeText(url.toString());
        showToast?.('Link copied to clipboard');
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={`absolute inset-y-0 right-0 max-w-full flex transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Transaction Details</h2>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Edit Transaction</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={copyLink} className="p-2 text-slate-400 hover:text-blue-500 transition-colors" title="Copy Link">
                    <LinkIcon size={20} />
                </button>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <X size={24} />
                </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Payee */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> Payee
              </label>
              <input
                type="text"
                value={formData.payee || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, payee: e.target.value }))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-lg focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <DollarSign size={14} /> Amount
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className={`w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-lg focus:ring-2 focus:ring-blue-500/20 ${parseFloat(amountInput) >= 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} /> Date
                    </label>
                    <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                    />
                </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Folder size={14} /> Category
              </label>
              <select
                value={formData.category || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
              >
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            {/* Account */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={14} /> Account
              </label>
              <select
                value={formData.accountId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={14} /> Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['uncleared', 'cleared', 'reconciled'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFormData(prev => ({ ...prev, status: s as Transaction['status'] }))}
                        className={`p-3 rounded-xl text-xs font-bold uppercase transition-all border-2 ${formData.status === s 
                            ? (s === 'reconciled' ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : s === 'cleared' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-slate-200 border-slate-400 text-slate-700')
                            : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        {s}
                    </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
