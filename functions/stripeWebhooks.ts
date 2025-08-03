import * as functions from 'firebase-functions/v1';
import { Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { RawBodyRequest } from './types';
import { db } from './firebase';

const STRIPE_SECRET_KEY =
  functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET =
  functions.config().stripe.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' } as any);

async function logTransaction(
  uid: string,
  amount: number,
  eventType: string,
) {
  try {
    await db.collection(`users/${uid}/transactions`).add({
      amount,
      eventType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    functions.logger.error('Failed to log transaction', err);
  }
}

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
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const uid = pi.metadata?.uid;
          const type = pi.metadata?.type;
          if (uid && type === 'subscription') {
            await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
            const amount = pi.amount_received || 0;
            await logTransaction(uid, amount, 'subscription');
          } else if (uid && type === 'token') {
            const tokens = parseInt(
              (pi.metadata?.tokenAmount as string) || (pi.metadata?.tokens as string) || '0',
              10,
            );
            if (tokens > 0) {
              await db
                .doc(`users/${uid}`)
                .set(
                  { tokenCount: admin.firestore.FieldValue.increment(tokens) },
                  { merge: true },
                );
            }
            const amount = pi.amount_received || 0;
            await logTransaction(uid, amount, 'token_purchase');
          }
          break;
        }
        case 'setup_intent.succeeded': {
          const si = event.data.object as Stripe.SetupIntent;
          const uid = si.metadata?.uid;
          if (uid && si.metadata?.type === 'subscription') {
            await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
            await logTransaction(uid, 0, 'subscription');
          }
          break;
        }
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionCancel(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const uid = invoice.metadata?.uid;
          if (uid) {
            await db.doc(`users/${uid}`).set({
              isSubscribed: true,
              tokenCount: admin.firestore.FieldValue.increment(25)
            }, { merge: true });
            const amount = invoice.amount_paid || 0;
            await db.collection(`users/${uid}/transactions`).add({
              amount,
              eventType: 'subscription',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          break;
        }
        default:
          functions.logger.info('Unhandled event type', event.type);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      functions.logger.error('Webhook handling failed', err);
      res.status(500).json({ error: 'Internal webhook error' });
    }
  },
);
