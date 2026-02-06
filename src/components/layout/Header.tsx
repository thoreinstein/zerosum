import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  toBeBudgeted: number;
}

export default function Header({ title, subtitle, toBeBudgeted }: HeaderProps) {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 bg-[#fcfcfd]/80 dark:bg-[#0f172a]/80 backdrop-blur-md pt-6 pb-4 md:pt-10 md:pb-6 flex items-center justify-between z-20">
      <div className="flex flex-col">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight uppercase tracking-widest text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="text-[10px] md:text-sm text-slate-500 font-medium">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Ready to Assign</p>
          <p className={`text-lg md:text-2xl font-bold ${toBeBudgeted < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            ${toBeBudgeted.toLocaleString()}
          </p>
        </div>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Sign Out">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
