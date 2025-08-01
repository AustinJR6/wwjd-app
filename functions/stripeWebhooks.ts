import * as functions from 'firebase-functions/v1';
import { Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { RawBodyRequest } from './types';
import { db } from './firebase';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' } as any);

function verifyEvent(req: RawBodyRequest, res: Response): Stripe.Event | null {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) {
    res.status(400).json({ error: 'Signature required' });
    return null;
  }
  try {
    return stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    functions.logger.error('Webhook signature verification failed', err);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return null;
  }
}

function getUidFromSession(session: Stripe.Checkout.Session): string | undefined {
  return (
    (session.metadata?.uid as string) ||
    (session.client_reference_id as string) ||
    undefined
  );
}

async function handleSubscriptionSuccess(session: Stripe.Checkout.Session) {
  const uid = getUidFromSession(session);
  if (!uid) return;
  await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
}

async function handleTokenPurchase(session: Stripe.Checkout.Session) {
  const uid = getUidFromSession(session);
  const tokens = parseInt((session.metadata?.tokens as string) || '0', 10);
  if (!uid || tokens <= 0) return;
  await db.doc(`users/${uid}`).set(
    { tokens: admin.firestore.FieldValue.increment(tokens) },
    { merge: true },
  );
}

async function handleDonation(session: Stripe.Checkout.Session) {
  const uid = getUidFromSession(session);
  if (!uid) return;
  const amount = session.amount_total || 0;
  await db.collection(`users/${uid}/donations`).add({
    amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const uid = (sub.metadata?.uid as string) || undefined;
  if (!uid) return;
  const active = sub.status !== 'canceled' && sub.status !== 'incomplete_expired';
  await db.doc(`users/${uid}`).set({ isSubscribed: active }, { merge: true });
}

async function handleSubscriptionCancel(sub: Stripe.Subscription) {
  const uid = (sub.metadata?.uid as string) || undefined;
  if (!uid) return;
  await db.doc(`users/${uid}`).set({ isSubscribed: false }, { merge: true });
}

export const handleStripeWebhookV2 = functions.https.onRequest(
  async (req: RawBodyRequest, res: Response) => {
    const event = verifyEvent(req, res);
    if (!event) return;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleSubscriptionSuccess(session);
        } else if (session.mode === 'payment') {
          const type = session.metadata?.type;
          if (type === 'token_purchase') {
            await handleTokenPurchase(session);
          } else if (type === 'donation') {
            await handleDonation(session);
          }
        }
        break;
      }
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancel(event.data.object as Stripe.Subscription);
        break;
      default:
        functions.logger.info('Unhandled event type', event.type);
    }

    res.status(200).json({ received: true });
  },
);
