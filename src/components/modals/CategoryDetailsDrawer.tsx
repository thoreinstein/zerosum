import { useState, useEffect } from 'react';
import { Category } from '@/hooks/useFinanceData';
import { X, Target, Calendar, Info } from 'lucide-react';

interface CategoryDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  onSave: (id: string, data: Partial<Category>) => void;
}

export default function CategoryDetailsDrawer({ isOpen, onClose, category, onSave }: CategoryDetailsDrawerProps) {
  const [targetType, setTargetType] = useState<Category['targetType']>(category.targetType || 'monthly');
  const [targetAmount, setTargetAmount] = useState<number>(category.targetAmount || 0);
  const [targetDate, setTargetDate] = useState<string>(category.targetDate || '');

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetType(category.targetType || 'monthly');
      setTargetAmount(category.targetAmount || 0);
      setTargetDate(category.targetDate || '');
    }
  }, [category, isOpen]);

  const handleSave = () => {
    onSave(category.id, {
      targetType,
      targetAmount,
      targetDate: targetType === 'balance_by_date' ? targetDate : undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={`absolute inset-y-0 right-0 max-w-full flex transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{category.name}</h2>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Budget Target</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Target Type */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target size={14} /> Target Type
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'monthly', label: 'Monthly Builder', desc: 'Budget a specific amount each month.' },
                  { id: 'balance', label: 'Target Balance', desc: 'Build up a balance over time.' },
                  { id: 'balance_by_date', label: 'Target Balance by Date', desc: 'Reach a goal by a specific month.' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setTargetType(type.id as Category['targetType'])}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${targetType === type.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                  >
                    <p className={`font-bold text-sm ${targetType === type.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{type.label}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Amount */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                $ Amount
              </label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-bold text-xl focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                placeholder="0.00"
              />
            </div>

            {/* Target Date */}
            {targetType === 'balance_by_date' && (
              <div className="space-y-2 animate-in slide-in-from-top-4 duration-200">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} /> Target Month
                </label>
                <input
                  type="month"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl flex gap-3">
                <Info size={20} className="text-blue-500 shrink-0" />
                <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                    Setting a target helps you know exactly how much more you need to budget to stay on track with your goals.
                </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              Save Target
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
