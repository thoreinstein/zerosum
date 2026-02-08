'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboardData } from '@/context/DashboardContext';
import TransactionsView from '@/components/views/TransactionsView';
import ReconcileModal from '@/components/modals/ReconcileModal';

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAccountId = searchParams.get('accountId');
  const { updateTransaction, reconcileAccount, accounts } = useDashboardData();

  const [isReconciling, setIsReconciling] = useState(false);
  const activeAccount = accounts.find(a => a.id === selectedAccountId);

  const toggleTransactionStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'cleared' ? 'reconciled' : currentStatus === 'reconciled' ? 'uncleared' : 'cleared';
    updateTransaction(id, { status: nextStatus as 'cleared' | 'reconciled' | 'uncleared' });
  };

  const handleClearSelection = () => {
    router.push('/transactions');
  };

  return (
    <>
      <TransactionsView
        selectedAccountId={selectedAccountId}
        onClearSelection={handleClearSelection}
        onReconcile={() => setIsReconciling(true)}
        onToggleStatus={toggleTransactionStatus}
      />
      {selectedAccountId && activeAccount && (
        <ReconcileModal
          isOpen={isReconciling}
          onClose={() => setIsReconciling(false)}
          onFinish={async () => {
             await reconcileAccount(selectedAccountId);
             setIsReconciling(false);
          }}
          account={activeAccount}
        />
      )}
    </>
  );
}
