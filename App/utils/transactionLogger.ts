import { addDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

type TransactionType = 'subscription' | 'tokens' | 'donation';

export async function logTransaction(
  type: TransactionType,
  amount: number,
  extra?: Partial<{ plan: string; currency: string; paymentIntentId: string; tokens: number }>,
) {
  const uid = await ensureAuth();
  if (!uid) return;
  try {
    await addDocument(`users/${uid}/transactions`, {
      type,
      amount,
      ...(extra || {}),
      // Use Date to let REST adapter encode as timestamp
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Failed to log transaction', err);
  }
}
