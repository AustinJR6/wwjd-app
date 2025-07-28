import { addDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export async function logTransaction(type: string, amount: number) {
  const uid = await ensureAuth();
  if (!uid) return;
  try {
    await addDocument(`users/${uid}/transactions`, {
      type,
      amount,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to log transaction', err);
  }
}
