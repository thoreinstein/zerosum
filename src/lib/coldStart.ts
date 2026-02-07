import { 
  collection, 
  query, 
  getDocs, 
  writeBatch, 
  doc, 
  Firestore,
  limit
} from 'firebase/firestore';

export async function checkAndSeedColdStart(db: Firestore, uid: string, selectedMonth: string) {
  // Idempotency check: only seed if no accounts exist
  const q = query(collection(db, 'users', uid, 'accounts'), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) return;

  const batch = writeBatch(db);

  const accountsData = [
    { name: 'Main Checking', type: 'Checking', balance: 0 },
    { name: 'Savings', type: 'Savings', balance: 0 },
  ];

  for (const acc of accountsData) {
    const ref = doc(collection(db, 'users', uid, 'accounts'));
    batch.set(ref, acc);
  }

  const categoriesData = [
    { name: 'Ready to Assign', budgeted: 0, color: 'bg-slate-500', hex: '#64748b', isRta: true },
    { name: 'Rent / Mortgage', budgeted: 0, color: 'bg-blue-500', hex: '#3b82f6' },
    { name: 'Groceries', budgeted: 0, color: 'bg-emerald-500', hex: '#10b981' },
    { name: 'Utilities', budgeted: 0, color: 'bg-yellow-500', hex: '#eab308' },
    { name: 'Dining Out', budgeted: 0, color: 'bg-orange-500', hex: '#f97316' },
  ];

  for (const cat of categoriesData) {
    const metaRef = doc(collection(db, 'users', uid, 'categories'));
    batch.set(metaRef, {
      name: cat.name,
      color: cat.color,
      hex: cat.hex,
      isRta: cat.isRta || false
    });

    const allocId = `${selectedMonth}_${metaRef.id}`;
    const allocRef = doc(db, 'users', uid, 'monthly_allocations', allocId);
    batch.set(allocRef, {
      month: selectedMonth,
      categoryId: metaRef.id,
      budgeted: cat.budgeted
    });
  }

  await batch.commit();
}
