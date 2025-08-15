/**
 * Quick verification script for token crediting logic.
 *
 * Requires Firestore emulator running on localhost:8080.
 * Run with:
 *   npx ts-node functions/tokenCreditVerification.ts
 */
import * as admin from 'firebase-admin';
import { creditTokenPurchase } from './stripeWebhooks';

(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'demo-test' });
  const db = admin.firestore();
  const uid = 'user_test';
  const userRef = db.doc(`users/${uid}`);
  await userRef.set({ tokens: 0 }, { merge: true });

  await creditTokenPurchase({ uid, tokens: 3, amount: 500, paymentId: 'pi_test' });

  const snap = await userRef.get();
  const tokens = snap.data()?.tokens;
  if (tokens !== 3) {
    throw new Error(`Expected 3 tokens, got ${tokens}`);
  }
  console.log('Token credit verified:', tokens);
})();
