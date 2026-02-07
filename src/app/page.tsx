'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
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
import { Plus } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  
  const {
    accounts, categories, transactions, loading: dataLoading,
    addTransaction, updateTransaction, updateCategory, addCategory, deleteCategory, reconcileAccount, seedData
  } = useFinanceData(selectedMonth);

  const [activeTab, setActiveTab] = useState('budget');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Computed
  const totalBudgeted = useMemo(() => categories.filter(c => !c.isRta).reduce((sum, cat) => sum + cat.budgeted, 0), [categories]);
  const totalSpent = useMemo(() => categories.reduce((sum, cat) => sum + cat.spent, 0), [categories]);
  const totalInflowValue = useMemo(() => accounts.reduce((sum, acc) => sum + acc.balance, 0), [accounts]);
  const rtaBalance = totalInflowValue - totalBudgeted;

  const activeAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  const filteredTransactions = useMemo(() => {
    return selectedAccountId
      ? transactions.filter(t => t.accountId === selectedAccountId)
      : transactions;
  }, [transactions, selectedAccountId]);

  // Handle dark mode class on body/html
  if (typeof document !== 'undefined') {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }

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
    <div className={`min-h-screen flex flex-col md:flex-row font-['Inter'] ${isDarkMode ? 'dark' : ''} bg-[#fcfcfd] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(t) => { setActiveTab(t); setSelectedAccountId(null); }}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      <main className="flex-1 flex flex-col pb-24 md:pb-0 overflow-y-auto custom-scrollbar relative px-4 md:px-8">
        <Header
          title={activeTab === 'budget' ? 'Budget' : activeTab === 'accounts' ? (selectedAccountId ? activeAccount?.name || 'Accounts' : 'Accounts') : activeTab === 'reports' ? 'Reports' : 'Activity'}
          subtitle={selectedAccountId ? `${activeAccount?.type} Account` : 'Financial control center.'}
          rtaBalance={rtaBalance}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />

        {activeTab === 'budget' && (
          <BudgetView
            categories={categories}
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
            transactions={filteredTransactions}
            selectedAccountId={selectedAccountId}
            onClearSelection={() => setSelectedAccountId(null)}
            onReconcile={() => setIsReconciling(true)}
            onToggleStatus={toggleTransactionStatus}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView transactions={transactions} categories={categories} totalSpent={totalSpent} />
        )}

        <button
          onClick={() => setShowTransactionModal(true)}
          className="fixed bottom-24 right-6 md:bottom-10 md:right-10 bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-30 transition-transform active:scale-90 hover:scale-105 cursor-pointer"
        >
          <Plus size={32} />
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
           setShowTransactionModal(false);
        }}
        defaultAccountId={selectedAccountId || undefined}
      />

      {selectedAccountId && activeAccount && (
        <ReconcileModal
          isOpen={isReconciling}
          onClose={() => setIsReconciling(false)}
          onFinish={handleReconcileFinish}
          account={activeAccount}
        />
      )}
    </div>
  );
}
