import { useState, useMemo } from 'react';
import { Category, Account } from '@/hooks/useFinanceData';
import { Plus, Edit2, Trash2, AlertCircle, Layers, ShoppingBag, Hourglass, TrendingUp } from 'lucide-react';
import CategoryModal from '../modals/CategoryModal';
import CategoryDetailsDrawer from '../modals/CategoryDetailsDrawer';

interface BudgetViewProps {
  categories: Category[];
  accounts: Account[];
  totalBudgeted: number;
  totalSpent: number;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addCategory: (data: Omit<Category, 'id' | 'activity' | 'available'>) => void;
}

// Helper to format currency
const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BudgetView({ categories, accounts, totalBudgeted, totalSpent, updateCategory, deleteCategory, addCategory }: BudgetViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedForDetails, setSelectedForDetails] = useState<Category | null>(null);

  const ccPaymentCategories = useMemo(() => {
      return categories.filter(c => c.isCcPayment).map(cat => {
          const account = accounts.find(a => a.id === cat.linkedAccountId);
          const isUnderfunded = cat.available < Math.abs(account?.balance || 0);
          return { ...cat, account, isUnderfunded };
      });
  }, [categories, accounts]);

  const categoryStats = useMemo(() => {
      return categories.filter(c => !c.isCcPayment && !c.isRta).map(cat => {
          let needed = 0;
          let isUnderfunded = false;

          if (cat.targetType === 'monthly' && cat.targetAmount) {
              needed = Math.max(0, cat.targetAmount - cat.budgeted);
              isUnderfunded = cat.budgeted < cat.targetAmount;
          } else if (cat.targetType === 'balance' && cat.targetAmount) {
              needed = Math.max(0, cat.targetAmount - cat.available);
              isUnderfunded = cat.available < cat.targetAmount;
          } else if (cat.targetType === 'balance_by_date' && cat.targetAmount && cat.targetDate) {
              const targetDate = new Date(cat.targetDate);
              const now = new Date();
              const monthsLeft = Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth()) + 1);
              const totalNeeded = Math.max(0, cat.targetAmount - cat.available);
              needed = totalNeeded / monthsLeft;
              isUnderfunded = cat.budgeted < needed;
          }

          return { ...cat, needed, isUnderfunded };
      });
  }, [categories]);

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
    <div className="space-y-6 mb-10">
      {/* Summary Cards */}
      <div className="flex overflow-x-auto hide-scrollbar gap-4 px-4 -mx-4 pb-4 md:grid md:grid-cols-3 md:gap-6 md:px-0 md:mx-0 md:pb-0">

        {/* Total Budgeted Card */}
        <div className="min-w-[240px] glass-card p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-medium">Total Budgeted</span>
            <Layers className="text-slate-300" size={24} />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">${formatCurrency(totalBudgeted)}</div>
          <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-slate-400 w-full"></div>
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="min-w-[240px] glass-card p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-medium">Total Spent</span>
            <ShoppingBag className="text-slate-300" size={24} />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">${formatCurrency(totalSpent)}</div>
          <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
             <div
                className="h-full bg-blue-600 w-full transition-all duration-1000"
                style={{ width: totalBudgeted > 0 ? `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` : '0%' }}
            ></div>
          </div>
        </div>

        {/* Age of Money Card */}
        <div className="min-w-[240px] glass-card p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 font-medium">Age of Money</span>
            <Hourglass className="text-slate-300" size={24} />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">14 Days</div>
          <p className="text-xs text-emerald-500 mt-4 flex items-center font-semibold">
            <TrendingUp size={16} className="mr-1" />
            +2 from last month
          </p>
        </div>
      </div>

      {/* Category List */}
      <div className="glass-card rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Categories</h3>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus size={14} /> Add Category
          </button>
        </div>
        
        {/* Desktop Table Headers */}
        <div className="hidden md:grid grid-cols-[1fr,120px,120px,120px] gap-4 px-8 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Category</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-right">Budgeted</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-right">Activity</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 text-right">Available</span>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800/50 p-4 md:p-0">
          {/* CC Payments Group */}
          {ccPaymentCategories.length > 0 && (
            <>
               <div className="md:px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/30 dark:bg-slate-800/10 rounded-xl md:rounded-none mb-2 md:mb-0">
                Credit Card Payments
              </div>
              {ccPaymentCategories.map(cat => (
                 <div
                      key={cat.id}
                      className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors rounded-2xl md:rounded-none mb-3 md:mb-0 p-4 md:px-8 md:py-5 border border-slate-100 dark:border-slate-800 md:border-none shadow-sm md:shadow-none bg-white dark:bg-slate-900/50 md:bg-transparent md:grid md:grid-cols-[1fr,120px,120px,120px] md:gap-4 md:items-center`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedForDetails(cat)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedForDetails(cat);
                        }
                      }}
                 >
                    {/* Category Column */}
                    <div className="flex flex-col flex-1 cursor-pointer">
                        <div className="flex items-center gap-3 mb-2 md:mb-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.hex }}></div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{cat.name}</span>
                            {cat.isUnderfunded && (
                                <AlertCircle size={14} className="text-amber-500" />
                            )}
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full opacity-60 rounded-full" style={{ backgroundColor: cat.hex, width: `${cat.budgeted > 0 ? Math.min((Math.abs(cat.activity) / cat.budgeted) * 100, 100) : 0}%` }}></div>
                        </div>
                    </div>

                    {/* Mobile: Available Right */}
                    <div className="md:hidden flex flex-col items-end mt-[-2.5rem]">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${cat.available > 0 ? (cat.isUnderfunded ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600') : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            ${formatCurrency(cat.available)}
                        </span>
                    </div>

                    {/* Desktop Columns */}
                    <div className="hidden md:flex flex-col items-end">
                         <input
                            type="number"
                            value={cat.budgeted}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateCategory(cat.id, { budgeted: val });
                            }}
                             onClick={(e) => e.stopPropagation()}
                            className="w-full text-right bg-transparent border-none p-0 focus:ring-0 text-slate-500 dark:text-slate-400 font-medium"
                        />
                    </div>
                    <div className="hidden md:flex flex-col items-end">
                         <span className={`text-right font-medium ${cat.activity < 0 ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-500'}`}>
                            {cat.activity !== 0 ? (cat.activity > 0 ? `+$${formatCurrency(cat.activity)}` : `-$${formatCurrency(Math.abs(cat.activity))}`) : '$0.00'}
                        </span>
                    </div>
                    <div className="hidden md:flex flex-col items-end">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${cat.available > 0 ? (cat.isUnderfunded ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400') : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            ${formatCurrency(cat.available)}
                        </span>
                    </div>
                 </div>
              ))}
               <div className="md:px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/30 dark:bg-slate-800/10 rounded-xl md:rounded-none mb-2 md:mb-0 md:mt-4">
                Main Categories
              </div>
            </>
          )}

          {categoryStats.map(cat => (
            <div key={cat.id}
                className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors rounded-2xl md:rounded-none mb-3 md:mb-0 p-4 md:px-8 md:py-5 border border-slate-100 dark:border-slate-800 md:border-none shadow-sm md:shadow-none bg-white dark:bg-slate-900/50 md:bg-transparent md:grid md:grid-cols-[1fr,120px,120px,120px] md:gap-4 md:items-center`}
                onClick={() => setSelectedForDetails(cat)}
            >
                {/* Category Column */}
                <div className="flex flex-col flex-1 cursor-pointer">
                    <div className="flex items-center gap-3 mb-2 md:mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.hex }}></div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{cat.name}</span>
                        {!cat.isRta && (
                            <div className="hidden group-hover:flex gap-2 ml-2 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(cat); }} className="text-slate-400 hover:text-blue-500"><Edit2 size={12} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                        )}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full opacity-60 rounded-full" style={{ backgroundColor: cat.hex, width: `${cat.budgeted > 0 ? Math.min((Math.abs(cat.activity) / cat.budgeted) * 100, 100) : 0}%` }}></div>
                    </div>
                </div>

                {/* Mobile: Available Right */}
                <div className="md:hidden flex flex-col items-end mt-[-2.5rem]">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${cat.available > 0 ? (cat.isUnderfunded ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600') : (cat.available < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}`}>
                        ${formatCurrency(cat.available)}
                    </span>
                </div>

                {/* Desktop Columns */}
                <div className="hidden md:flex flex-col items-end">
                    {!cat.isRta ? (
                    <input
                        type="number"
                        value={cat.budgeted}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateCategory(cat.id, { budgeted: val });
                        }}
                         onClick={(e) => e.stopPropagation()}
                        className="w-full text-right bg-transparent border-none p-0 focus:ring-0 text-slate-500 dark:text-slate-400 font-medium"
                    />
                    ) : <div />}
                </div>
                <div className="hidden md:flex flex-col items-end">
                    <span className={`text-right font-medium ${cat.activity < 0 ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-500'}`}>
                        {cat.activity !== 0 ? (cat.activity > 0 ? `+${formatCurrency(cat.activity)}` : `-$${formatCurrency(Math.abs(cat.activity))}`) : '$0.00'}
                    </span>
                </div>
                <div className="hidden md:flex flex-col items-end">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${cat.available > 0 ? (cat.isUnderfunded ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400') : (cat.available < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}`}>
                        ${formatCurrency(cat.available)}
                    </span>
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

      {selectedForDetails && (
          <CategoryDetailsDrawer
            isOpen={!!selectedForDetails}
            onClose={() => setSelectedForDetails(null)}
            category={selectedForDetails}
            onSave={updateCategory}
          />
      )}
    </div>
  );
}
