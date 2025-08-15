import * as admin from 'firebase-admin';
import { getStripe } from './stripeClient';

const db = admin.firestore();

export async function getOrCreateStripeCustomer(uid: string, email?: string) {
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : undefined;

  let stripeCustomerId = data?.stripeCustomerId as string | undefined;
  const stripe = getStripe();

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { uid },
    });
    stripeCustomerId = customer.id;
    await userRef.set({ stripeCustomerId }, { merge: true });
  }
  return stripeCustomerId!;
}
