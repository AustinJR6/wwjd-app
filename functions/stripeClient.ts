import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('[Stripe] Missing STRIPE_SECRET_KEY at runtime.');
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, { apiVersion: '2023-10-16' } as any);
  }
  return stripeSingleton;
}
