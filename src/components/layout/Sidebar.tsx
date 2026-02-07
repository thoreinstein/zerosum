import { LayoutDashboard, Landmark, Receipt, ChartPie, Sun, Moon, Wallet, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isDarkMode, toggleDarkMode }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-20 border-r border-slate-200 dark:border-slate-800 flex-col items-center py-8 gap-8 bg-white dark:bg-slate-900 z-10 sticky top-0 h-screen">
      <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
        <Wallet size={32} />
      </div>
      <nav className="flex flex-col gap-6 flex-1">
        <NavButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={<LayoutDashboard size={24} />} title="Budget" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<Receipt size={24} />} title="Transactions" />
        <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<ChartPie size={24} />} title="Reports" />
        <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Landmark size={24} />} title="Accounts" />
      </nav>
      <div className="flex flex-col gap-4 mt-auto">
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-2xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
          title={isDarkMode ? "Light Mode" : "Dark Mode"}
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <button
          className="p-3 rounded-2xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>
    </aside>
  );
}

function NavButton({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-3 rounded-2xl transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:scale-105'
          : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200'
      }`}
    >
      {icon}
    </button>
  );
}
