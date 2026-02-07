import { useState } from 'react';
import { Category } from '@/hooks/useFinanceData';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import CategoryModal from '../modals/CategoryModal';

interface BudgetViewProps {
  categories: Category[];
  totalBudgeted: number;
  totalSpent: number;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addCategory: (data: Omit<Category, 'id' | 'activity' | 'available'>) => void;
}

export default function BudgetView({ categories, totalBudgeted, totalSpent, updateCategory, deleteCategory, addCategory }: BudgetViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this category?')) {
      deleteCategory(id);
    }
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="glass-card p-4 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-tighter">Budgeted</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">${totalBudgeted.toLocaleString()}</p>
        </div>
        <div className="glass-card p-4 rounded-2xl border-l-4 border-l-blue-600/30">
          <p className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-tighter">Spent</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Categories</h3>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add New
          </button>
        </div>
        
        {/* Table Headers */}
        <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 hidden md:grid grid-cols-[1fr,100px,100px,100px] gap-4 items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Category</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Budgeted</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Activity</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Available</span>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
          {categories.map(cat => (
            <div key={cat.id} className="p-4 flex flex-col gap-3 group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.hex }}></div>
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{cat.name}</span>
                  {!cat.isRta && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ml-2">
                      <button onClick={() => handleEdit(cat)} className="text-slate-400 hover:text-blue-500"><Edit2 size={12} /></button>
                      <button onClick={() => handleDelete(cat.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                
                {/* Desktop View Row */}
                <div className="hidden md:grid grid-cols-[100px,100px,100px] gap-4 items-center">
                    {!cat.isRta ? (
                        <input
                            type="number"
                            value={cat.budgeted}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateCategory(cat.id, { budgeted: val });
                            }}
                            className="w-full text-right bg-transparent border-none p-0 focus:ring-0 text-[11px] font-bold text-slate-500"
                        />
                    ) : <div />}
                    <span className={`text-[11px] font-bold text-right ${cat.activity < 0 ? 'text-slate-400' : 'text-emerald-500'}`}>
                        {cat.activity !== 0 ? (cat.activity > 0 ? `+${cat.activity.toLocaleString()}` : `-$${Math.abs(cat.activity).toLocaleString()}`) : '$0'}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg text-right ${cat.available > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : cat.available < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                        ${cat.available.toLocaleString()}
                    </span>
                </div>

                {/* Mobile View Status Pill */}
                <div className="md:hidden">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cat.available > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : cat.available < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                        ${cat.available.toLocaleString()}
                    </span>
                </div>
              </div>

              {/* Progress Bar & Mobile Input */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full opacity-60 transition-all duration-500" style={{ backgroundColor: cat.hex, width: `${cat.budgeted > 0 ? Math.min((Math.abs(cat.activity) / cat.budgeted) * 100, 100) : 0}%` }}></div>
                </div>
                <div className="md:hidden">
                    {!cat.isRta ? (
                    <input
                        type="number"
                        value={cat.budgeted}
                        onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateCategory(cat.id, { budgeted: val });
                        }}
                        className="w-16 text-right bg-transparent border-none p-0 focus:ring-0 text-[11px] font-bold text-slate-500"
                    />
                    ) : (
                    <div className="w-16 h-4" />
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <CategoryModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          category={editingCategory}
          onSave={(data) => {
            if (editingCategory) updateCategory(editingCategory.id, data);
            else addCategory(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
