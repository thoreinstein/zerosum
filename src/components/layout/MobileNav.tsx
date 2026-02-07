import { LayoutDashboard, Landmark, Receipt, ChartPie, Settings } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MobileNav({ activeTab, setActiveTab }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 px-6 py-3 flex items-center justify-between z-50">
      <NavButton
        active={activeTab === 'budget'}
        onClick={() => setActiveTab('budget')}
        label="Budget"
        icon={<LayoutDashboard size={24} />}
      />
      <NavButton
        active={activeTab === 'accounts'}
        onClick={() => setActiveTab('accounts')}
        label="Accounts"
        icon={<Landmark size={24} />}
      />
      <NavButton
        active={activeTab === 'transactions'}
        onClick={() => setActiveTab('transactions')}
        label="Activity"
        icon={<Receipt size={24} />}
      />
      <NavButton
        active={activeTab === 'reports'}
        onClick={() => setActiveTab('reports')}
        label="Reports"
        icon={<ChartPie size={24} />}
      />
       {/*
       Note: The design shows "Settings" instead of "Activity" or "Reports",
       but for functionality continuity with the desktop app and current state,
       we are keeping the main navigation tabs.
       If Settings is needed, we could add it or replace one, but Sidebar has Settings separately.
       */}
    </nav>
  );
}

function NavButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${
        active
          ? 'text-blue-600'
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
      }`}
    >
      {icon}
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
    </button>
  );
}
