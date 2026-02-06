import { LayoutDashboard, Landmark, Receipt, ChartPie } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MobileNav({ activeTab, setActiveTab }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around py-3 px-2 z-40">
      <NavButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} label="Budget" icon={<LayoutDashboard size={24} />} />
      <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} label="Accounts" icon={<Landmark size={24} />} />
      <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} label="Activity" icon={<Receipt size={24} />} />
      <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} label="Reports" icon={<ChartPie size={24} />} />
    </nav>
  );
}

function NavButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${active ? 'text-blue-600' : 'text-slate-400'}`}
    >
      {icon}
      <span className="text-[8px] font-bold uppercase">{label}</span>
    </button>
  );
}
