import { useState, useEffect } from 'react';
import { Category } from '@/hooks/useFinanceData';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSave: (data: Omit<Category, 'id'>) => void;
}

export default function CategoryModal({ isOpen, onClose, category, onSave }: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    hex: '#3b82f6',
    color: 'bg-blue-500'
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(prev => {
      if (category) {
        if (prev.name === category.name && prev.hex === category.hex) return prev;
        return { name: category.name, hex: category.hex, color: category.color };
      } else {
        if (prev.name === '' && prev.hex === '#3b82f6') return prev;
        return { name: '', hex: '#3b82f6', color: 'bg-blue-500' };
      }
    });
  }, [category, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      hex: formData.hex,
      color: formData.color,
      budgeted: category ? category.budgeted : 0,
      spent: category ? category.spent : 0
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl space-y-6 animate-in zoom-in duration-200">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{category ? 'Edit Category' : 'New Category'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
              placeholder="e.g. Subscriptions"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#3b82f6', '#10b981', '#f97316', '#ec4899', '#6366f1', '#eab308', '#ef4444', '#8b5cf6'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({...formData, hex: color})}
                  className={`w-10 h-10 rounded-full border-4 transition-all ${formData.hex === color ? 'border-blue-200 dark:border-blue-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                ></button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 p-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-500/20">
              {category ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
