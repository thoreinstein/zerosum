import { useState, useRef } from 'react';
import { Account, Category, Transaction } from '@/hooks/useFinanceData';
import { scanReceipt } from '@/app/actions/scanReceipt';
import { Camera, CameraOff, Sparkles, X, Clock } from 'lucide-react';
import { doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onAddTransaction: (data: Omit<Transaction, 'id'>, id?: string) => Promise<void>;
  defaultAccountId?: string;
  storeImage?: (txId: string, base64Image: string) => Promise<void>;
}

export default function TransactionModal({ isOpen, onClose, accounts, categories, onAddTransaction, defaultAccountId, storeImage }: TransactionModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    type: 'outflow',
    date: new Date().toISOString().split('T')[0],
    payee: '',
    category: 'Ready to Assign',
    amount: '',
    accountId: defaultAccountId || (accounts[0] ? accounts[0].id : '')
  });

  const [isScanning, setIsScanning] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      setCameraActive(false);
      alert('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL('image/png').split(',')[1];
          stopCamera();
          processReceipt(base64Data);
      }
    }
  };

  const processReceipt = async (base64Data: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsQueuing(true);
      try {
        if (!user) return;
        const txRef = doc(collection(db, 'users', user.uid, 'transactions'));
        const txId = txRef.id;

        if (storeImage) {
          await storeImage(txId, base64Data);
          await onAddTransaction({
            date: formData.date,
            payee: 'Queued Receipt',
            category: 'Ready to Assign',
            amount: 0,
            status: 'uncleared',
            accountId: formData.accountId,
            scanStatus: 'pending'
          }, txId);
          onClose();
        }
      } catch (error) {
        console.error('Failed to queue receipt:', error);
        alert('Failed to queue receipt for offline scanning.');
      }
      setIsQueuing(false);
      return;
    }

    setIsScanning(true);

    // Pass category names to help the AI
    const categoryNames = categories.map(c => c.name);

    try {
      const result = await scanReceipt(base64Data, categoryNames);

      if (result.success && result.data) {
          const { payee, amount, date, category } = result.data;
          setFormData(prev => ({
              ...prev,
              payee: payee || prev.payee,
              amount: amount ? String(amount) : prev.amount,
              date: date || prev.date,
              category: category || prev.category
          }));
      } else {
          alert('Failed to scan receipt: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to scan receipt.');
    }

    setIsScanning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formData.amount);

    const isCategoryInflow = formData.category === 'Ready to Assign';
    const finalAmount = isCategoryInflow ? Math.abs(amountVal) : -Math.abs(amountVal);

    await onAddTransaction({
        date: formData.date,
        payee: formData.payee,
        category: formData.category,
        amount: finalAmount,
        status: 'cleared',
        accountId: formData.accountId
    });

    setFormData({
        type: 'outflow',
        date: new Date().toISOString().split('T')[0],
        payee: '',
        category: 'Ready to Assign',
        amount: '',
        accountId: formData.accountId
    });
    onClose();
  };

  const handleClose = () => {
      stopCamera();
      onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-lg h-[90vh] md:h-auto overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">New Transaction</h2>
          <button onClick={handleClose} className="text-slate-400 p-2"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-6 pb-12">
          <button onClick={cameraActive ? stopCamera : startCamera} className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all cursor-pointer ${cameraActive ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white shadow-lg'}`}>
            {cameraActive ? <CameraOff size={24} /> : <Camera size={24} />} {cameraActive ? 'Cancel Camera' : 'Scan Receipt'}
          </button>
          {cameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <button type="button" onClick={capturePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center cursor-pointer">
                  <div className="w-12 h-12 border-2 border-slate-900 rounded-full" />
              </button>
            </div>
          )}
          {isScanning && <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-center gap-3 text-blue-600 text-sm animate-pulse"><Sparkles className="animate-spin" size={20} /> Analyzing...</div>}
          {isQueuing && <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl flex items-center gap-3 text-amber-600 text-sm animate-pulse"><Clock className="animate-spin" size={20} /> Queuing for offline scan...</div>}
          {!cameraActive && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Account</label>
                <select value={formData.accountId} onChange={(e) => setFormData({...formData, accountId: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm text-slate-900 dark:text-slate-100">
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm text-slate-900 dark:text-slate-100" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Amount</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-slate-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Payee</label>
                <input type="text" placeholder="Merchant" value={formData.payee} onChange={(e) => setFormData({...formData, payee: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm text-slate-900 dark:text-slate-100">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-600/30 cursor-pointer">Complete Entry</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
