'use client';

import { useState, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useTheme } from '@/context/ThemeContext';
import { useFinanceData } from '@/hooks/useFinanceData';
import { useAIQueue } from '@/hooks/useAIQueue';
import { DashboardProvider } from '@/context/DashboardContext';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import Header from '@/components/layout/Header';
import TransactionModal from '@/components/modals/TransactionModal';
import TransactionDetailsModal from '@/components/modals/TransactionDetailsModal';
import SettingsModal from '@/components/modals/SettingsModal';
import LoginView from '@/components/views/LoginView';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { selectedMonth, setSelectedMonth, refreshTransactions } = useFinance();
  const { theme, toggleTheme } = useTheme();
  
  const financeData = useFinanceData(selectedMonth);
  const {
    accounts, categories, transactions, loading: dataLoading,
    addTransaction, updateTransaction, seedData,
    isSyncing, isOnline, pendingMutations, retryMutation, toasts, addToast, retryingIds
  } = financeData;

  const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);
  const { storeImage } = useAIQueue(transactions, updateTransaction, categoryNames);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAccountId = searchParams.get('accountId');
  const txId = searchParams.get('txId');

  const activeTransaction = useMemo(() => 
    txId ? transactions.find(t => t.id === txId) : undefined
  , [transactions, txId]);

  const closeDetails = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('txId');
    router.push(`${pathname}?${params.toString()}`);
  };

  // Determine active tab from path
  const activeTab = useMemo(() => {
    if (pathname === '/' || pathname.startsWith('/budget')) return 'budget';
    if (pathname.startsWith('/accounts')) return 'accounts';
    if (pathname.startsWith('/transactions')) return 'transactions';
    if (pathname.startsWith('/reports')) return 'reports';
    return 'budget';
  }, [pathname]);

  const setActiveTab = (tab: string) => {
    if (tab === 'budget') router.push('/');
    else router.push(`/${tab}`);
  };

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Computed for Header
  const rtaCategory = useMemo(() => categories.find(c => c.isRta), [categories]);
  const rtaBalance = rtaCategory?.available || 0;
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

  const headerTitle = activeTab === 'budget' ? 'Budget' 
    : activeTab === 'accounts' ? (selectedAccountId ? activeAccount?.name || 'Accounts' : 'Accounts')
    : activeTab === 'reports' ? 'Reports' 
    : 'Activity'; 
    
  const headerSubtitle = selectedAccountId ? `${activeAccount?.type} Account` : 'Financial control center.';

  return (
    <DashboardProvider value={financeData}>
    <div className={`min-h-screen flex flex-col md:flex-row font-['Inter'] bg-[#fcfcfd] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={theme === 'dark'}
        toggleDarkMode={toggleTheme}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      <main className="flex-1 flex flex-col pb-24 md:pb-0 overflow-y-auto custom-scrollbar relative px-4 md:px-8">
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          rtaBalance={rtaBalance}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          isSyncing={isSyncing}
          isOnline={isOnline}
        />
        
        {children}

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
      
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

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

      {activeTransaction && (
        <TransactionDetailsModal
          key={activeTransaction.id}
          isOpen={!!activeTransaction}
          onClose={closeDetails}
          transaction={activeTransaction}
          accounts={accounts}
          categories={categories}
          onSave={async (id, data, balanceDelta) => {
             await updateTransaction(id, data, balanceDelta);
             refreshTransactions();
          }}
          showToast={addToast}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      
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
    </DashboardProvider>
  );
}
