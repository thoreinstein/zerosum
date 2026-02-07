import { X, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { forceRefresh, isRefreshing, refreshError } = useSettings();
  const [confirmForceRefresh, setConfirmForceRefresh] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-lg h-[80vh] md:h-auto overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-400 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8 pb-12">
          {/* Troubleshooting Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ShieldAlert size={20} className="text-blue-600" />
              <h3 className="font-bold">Troubleshooting</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              If your data seems out of sync or the application is behaving unexpectedly, you can force a fresh refetch from the server.
            </p>
          </div>

          {/* Danger Zone */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              <h3 className="font-bold uppercase tracking-wider text-xs">Danger Zone</h3>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 space-y-4">
              <p className="text-xs text-red-800 dark:text-red-400 font-medium leading-relaxed">
                Force Refresh will clear all local Firestore data and re-initialize the application. 
                Any unsaved local changes that haven&apos;t reached the server yet may be lost.
              </p>

              {!confirmForceRefresh ? (
                <button
                  onClick={() => setConfirmForceRefresh(true)}
                  className="w-full py-3 bg-white dark:bg-slate-800 text-red-600 border border-red-200 dark:border-red-900/50 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm"
                >
                  Force Data Refresh
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase text-center">Are you sure?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmForceRefresh(false)}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={forceRefresh}
                      disabled={isRefreshing}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                      {isRefreshing ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        'Yes, Reset Data'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {refreshError && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                Error: {refreshError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
