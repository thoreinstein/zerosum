'use client';

import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/context/DashboardContext';
import AccountsView from '@/components/views/AccountsView';

export default function AccountsPage() {
  const { accounts } = useDashboardData();
  const router = useRouter();

  const handleAccountSelect = (id: string | null) => {
    if (id) {
      router.push(`/transactions?accountId=${encodeURIComponent(id)}`);
    } else {
      router.push('/transactions');
    }
  };

  return (
    <AccountsView 
      accounts={accounts} 
      setSelectedAccountId={handleAccountSelect} 
    />
  );
}
