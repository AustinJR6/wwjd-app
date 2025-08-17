import Stripe from 'stripe';
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { auth, db } from '@core/firebase';
import {
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SUB_PRICE_ID,
  STRIPE_20_TOKEN_PRICE_ID,
  STRIPE_50_TOKEN_PRICE_ID,
  STRIPE_100_TOKEN_PRICE_ID,
} from '@core/secrets';
import {
  cleanPriceId,
  getTokensFromPriceId as baseGetTokensFromPriceId,
} from '@utils/index';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const stripeSecrets = [
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SUB_PRICE_ID,
  STRIPE_20_TOKEN_PRICE_ID,
  STRIPE_50_TOKEN_PRICE_ID,
  STRIPE_100_TOKEN_PRICE_ID,
];

const key =
  process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key || '';
if (!key) throw new Error('Missing Stripe secret key');
export const stripe = new Stripe(key, { apiVersion: '2024-06-20' });
export type { Stripe };

export function getPublishableKey(): string {
  return functions.config().stripe?.publishable || STRIPE_PUBLISHABLE_KEY.value();
}

export function getTokenPriceIds() {
  return {
    twenty: STRIPE_20_TOKEN_PRICE_ID.value(),
    fifty: STRIPE_50_TOKEN_PRICE_ID.value(),
    hundred: STRIPE_100_TOKEN_PRICE_ID.value(),
  };
}

export function getTokensFromPriceId(
  priceId: string,
  ids: { twenty: string; fifty: string; hundred: string },
): 20 | 50 | 100 | null {
  return baseGetTokensFromPriceId(priceId, ids) as 20 | 50 | 100 | null;
}

export async function ensureStripeCustomer(uid: string): Promise<string> {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;

  if (!customerId) {
    const userRecord = await auth.getUser(uid);
    const customer = await stripe.customers.create({
      email: userRecord.email ?? undefined,
      metadata: { uid },
    });
    customerId = customer.id;
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  return customerId!;
}

export async function createEphemeralKey(customerId: string) {
  return stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2023-10-16' },
  );
}

export const serverTS = admin.firestore.FieldValue.serverTimestamp;

export { cleanPriceId };
