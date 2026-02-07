import { useAuth } from '@/context/AuthContext';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  rtaBalance: number;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export default function Header({ title, subtitle, rtaBalance, selectedMonth, onMonthChange }: HeaderProps) {
  const { logout } = useAuth();

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2);
    onMonthChange(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month);
    onMonthChange(date.toISOString().slice(0, 7));
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <header className="sticky top-0 bg-[#fcfcfd]/80 dark:bg-[#0f172a]/80 backdrop-blur-md pt-6 pb-4 md:pt-10 md:pb-6 flex items-center justify-between z-20">
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight uppercase tracking-widest text-slate-900 dark:text-slate-100">
            {title}
            </h1>
            {title === 'Budget' && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 ml-4">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors text-slate-500">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 min-w-[120px] text-center">
                        {formatMonth(selectedMonth)}
                    </span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors text-slate-500">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
        <p className="text-[10px] md:text-sm text-slate-500 font-medium">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right flex flex-col items-end">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
            {rtaBalance > 0 ? 'Ready to Assign' : rtaBalance < 0 ? 'Overbudgeted' : 'All Money Assigned'}
          </p>
          <div className={`px-4 py-2 rounded-2xl ${rtaBalance > 0 ? 'bg-emerald-500/10 text-emerald-500' : rtaBalance < 0 ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-500'} font-bold text-lg md:text-2xl transition-all`}>
            ${rtaBalance.toLocaleString()}
          </div>
        </div>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Sign Out">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
