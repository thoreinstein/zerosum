'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useTheme } from '@/context/ThemeContext';
import { useFinanceData } from '@/hooks/useFinanceData';
import LoginView from '@/components/views/LoginView';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import Header from '@/components/layout/Header';
import BudgetView from '@/components/views/BudgetView';
import AccountsView from '@/components/views/AccountsView';
import TransactionsView from '@/components/views/TransactionsView';
import ReportsView from '@/components/views/ReportsView';
import TransactionModal from '@/components/modals/TransactionModal';
import ReconcileModal from '@/components/modals/ReconcileModal';
import SettingsModal from '@/components/modals/SettingsModal';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { useAIQueue } from '@/hooks/useAIQueue';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { selectedMonth, setSelectedMonth, refreshTransactions } = useFinance();
  const { theme, toggleTheme } = useTheme();
  
  const {
    accounts, categories, transactions, loading: dataLoading,
    addTransaction, updateTransaction, updateCategory, addCategory, deleteCategory, reconcileAccount, seedData,
    isSyncing, isOnline, pendingMutations, retryMutation, toasts, retryingIds
  } = useFinanceData(selectedMonth);

  const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);
  const { storeImage } = useAIQueue(transactions, updateTransaction, categoryNames);

  const [activeTab, setActiveTab] = useState('budget');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Computed
  const rtaCategory = useMemo(() => categories.find(c => c.isRta), [categories]);
  const rtaBalance = rtaCategory?.available || 0;

  const totalBudgeted = useMemo(() => categories.filter(c => !c.isRta).reduce((sum, cat) => sum + cat.budgeted, 0), [categories]);
  const totalSpent = useMemo(() => categories.filter(c => !c.isRta).reduce((sum, cat) => sum + Math.abs(cat.activity), 0), [categories]);

  const activeAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  if (authLoading || (user && dataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin text-blue-600">
           <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Seed data if empty
  if (accounts.length === 0 && categories.length === 0 && !dataLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-6 p-4 text-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome to ZeroSum!</h1>
                <p className="text-slate-500">Let&apos;s set up your budget with some default data to get you started.</p>
              </div>
              <button onClick={seedData} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors">
                  Initialize Demo Data
              </button>
          </div>
      )
  }

  const toggleTransactionStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'cleared' ? 'reconciled' : currentStatus === 'reconciled' ? 'uncleared' : 'cleared';
    updateTransaction(id, { status: nextStatus as 'cleared' | 'reconciled' | 'uncleared' });
  };

  const handleReconcileFinish = async () => {
    if (selectedAccountId) {
        await reconcileAccount(selectedAccountId);
    }
    setIsReconciling(false);
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-['Inter'] bg-[#fcfcfd] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(t) => { setActiveTab(t); setSelectedAccountId(null); }}
        isDarkMode={theme === 'dark'}
        toggleDarkMode={toggleTheme}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      <main className="flex-1 flex flex-col pb-24 md:pb-0 overflow-y-auto custom-scrollbar relative px-4 md:px-8">
        <Header
          title={activeTab === 'budget' ? 'Budget' : activeTab === 'accounts' ? (selectedAccountId ? activeAccount?.name || 'Accounts' : 'Accounts') : activeTab === 'reports' ? 'Reports' : 'Activity'}
          subtitle={selectedAccountId ? `${activeAccount?.type} Account` : 'Financial control center.'}
          rtaBalance={rtaBalance}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          isSyncing={isSyncing}
          isOnline={isOnline}
        />

        {activeTab === 'budget' && (
          <BudgetView
            categories={categories}
            accounts={accounts}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
            updateCategory={updateCategory}
            deleteCategory={deleteCategory}
            addCategory={addCategory}
          />
        )}

        {activeTab === 'accounts' && !selectedAccountId && (
          <AccountsView accounts={accounts} setSelectedAccountId={setSelectedAccountId} />
        )}

        {(activeTab === 'transactions' || selectedAccountId) && (
          <TransactionsView
            selectedAccountId={selectedAccountId}
            onClearSelection={() => setSelectedAccountId(null)}
            onReconcile={() => setIsReconciling(true)}
            onToggleStatus={toggleTransactionStatus}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView 
            transactions={transactions} 
            categories={categories} 
            totalSpent={totalSpent} 
            selectedMonth={selectedMonth}
          />
        )}

        {/* Floating Action Button */}
        <button
          onClick={() => setShowTransactionModal(true)}
          className="
            fixed z-30 bg-blue-600 text-white shadow-2xl shadow-blue-600/40 transition-all active:scale-95
            bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center hover:scale-105
            md:bottom-10 md:right-10 md:w-auto md:h-auto md:p-5 md:gap-3 md:hover:scale-110 group
          "
        >
          <Plus size={28} className="md:w-6 md:h-6" />
          <span className="hidden md:block font-bold pr-0 max-w-0 overflow-hidden group-hover:max-w-[150px] group-hover:pr-2 transition-all duration-300 whitespace-nowrap">Add Transaction</span>
        </button>
      </main>

      <MobileNav activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedAccountId(null); }} />

      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        accounts={accounts}
        categories={categories}
        onAddTransaction={async (data) => {
           await addTransaction(data);
           refreshTransactions();
           setShowTransactionModal(false);
        }}
        defaultAccountId={selectedAccountId || undefined}
        storeImage={storeImage}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {selectedAccountId && activeAccount && (
        <ReconcileModal
          isOpen={isReconciling}
          onClose={() => setIsReconciling(false)}
          onFinish={handleReconcileFinish}
          account={activeAccount}
        />
      )}

      {/* Retry Notifications */}
      {pendingMutations.length > 0 && (
        <div className="fixed bottom-28 left-6 right-6 md:bottom-10 md:left-auto md:right-10 flex flex-col gap-2 z-50 pointer-events-none">
          {pendingMutations.slice(-3).map((mutation) => (
            <div 
              key={mutation.id} 
              className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 shadow-xl rounded-xl p-4 flex items-center gap-4 animate-in slide-in-from-right-5 pointer-events-auto"
            >
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-600">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Update Failed</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {mutation.type === 'add' ? 'Could not add ' : mutation.type === 'update' ? 'Could not update ' : 'Could not delete '}
                  {mutation.entity}
                </p>
              </div>
              <button 
                onClick={() => retryMutation(mutation.id)}
                disabled={retryingIds.has(mutation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <RefreshCw size={14} className={retryingIds.has(mutation.id) ? 'animate-spin' : ''} />
                {retryingIds.has(mutation.id) ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global Toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[60] pointer-events-none w-full max-w-sm px-4">
          {toasts.map((toast) => (
            <div 
              key={toast.id} 
              className={`
                p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto
                ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600' : 
                  toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600' : 
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}
              `}
            >
              {toast.type === 'error' && <AlertCircle size={18} />}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
