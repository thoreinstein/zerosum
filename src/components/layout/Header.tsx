import { useAuth } from '@/context/AuthContext';
import { LogOut, ChevronLeft, ChevronRight, CloudOff, CloudSync } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  rtaBalance: number;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  isSyncing?: boolean;
  isOnline?: boolean;
}

export default function Header({ 
  title, 
  subtitle, 
  rtaBalance, 
  selectedMonth, 
  onMonthChange, 
  isSyncing = false,
  isOnline = true
}: HeaderProps) {
  const { logout, user } = useAuth();

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

  // Only show month nav if the title is "Budget" (or if we are on the budget tab)
  const isBudgetTab = title === 'Budget';

  // Custom header content based on design
  const displayTitle = isBudgetTab ? `${formatMonth(selectedMonth)} Budget` : title;
  const displaySubtitle = isBudgetTab ? "Zero-sum achieved. Every dollar has a job." : subtitle;

  return (
    <>
      <header className="sticky top-0 bg-[#fcfcfd]/80 dark:bg-[#0f172a]/80 backdrop-blur-md pt-8 pb-4 px-6 flex items-center justify-between z-20">
        <div>
          <div className="flex items-center gap-2">
            {isBudgetTab && (
              <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {isBudgetTab ? (
                  <span className="hidden md:inline">{displayTitle}</span>
              ) : title}
              {isBudgetTab && (
                  <span className="md:hidden">{formatMonth(selectedMonth)}</span>
              )}
            </h1>
            {isBudgetTab && (
              <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          <p className="hidden md:block text-slate-500 dark:text-slate-400 font-medium mt-1">
            {displaySubtitle}
          </p>
          <p className="md:hidden text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
             {isBudgetTab ? "Zero-Based Budget" : subtitle}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Sync Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" aria-live="polite">
            <span className="sr-only">
              {!isOnline ? "Application is offline" : isSyncing ? "Syncing changes with server" : "All changes synced"}
            </span>
            {!isOnline ? (
              <>
                <CloudOff size={14} className="text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Offline</span>
              </>
            ) : isSyncing ? (
              <>
                <CloudSync size={14} className="text-blue-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Syncing</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Synced</span>
              </>
            )}
          </div>

          {/* Desktop "To Be Budgeted" */}
          <div className="hidden md:block text-right mr-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">To Be Budgeted</p>
            <p className={`text-2xl font-bold ${rtaBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ${rtaBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <img
              alt="User Profile"
              src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuCQJAyWgraP0W0NVA9Rf7gvjXLfhcL_fMrBFXorVyQd4sbJcqifFS5OX7PtQz4TxGtTeJFpDoy1ECt_8KGywRAilAczS-4fJAFW3cF2gFNLq6_qJ_RuWM4Ufp3UYHph9IffLwQ--ainhsUFFwgY2jdXIuWk2EgfjoVnPnpkhsITL8fvTVn6qXQgtyiMmJvgSuzT3wGPHYoSHdW1x9AQK6aCghMpvhPF52aR7d5DvsgULJryQ5kipT6kjjZoI4f_o1eAPU6PgiQjaWY"}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-hidden="true"
            >
              <LogOut size={16} className="text-white" />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile "To Be Budgeted" */}
      {isBudgetTab && (
        <div className="md:hidden flex flex-col items-center mt-2 mb-6">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">To Be Budgeted</span>
          <div className={`text-3xl font-bold ${rtaBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            ${rtaBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </>
  );
}
