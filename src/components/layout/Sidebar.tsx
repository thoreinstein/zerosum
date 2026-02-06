import { LayoutDashboard, Landmark, Receipt, ChartPie, Sun, Moon, Wallet } from 'lucide-react';

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
        <NavButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={<LayoutDashboard />} />
        <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Landmark />} />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<Receipt />} />
        <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<ChartPie />} />
      </nav>
      <button onClick={toggleDarkMode} className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>
    </aside>
  );
}

function NavButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-2xl transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
    </button>
  );
}
