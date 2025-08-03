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
  eventType: 'subscription' | 'token',
  tokenAmount = 25,
) {
  try {
    functions.logger.info('Logging transaction', {
      uid,
      amount,
      eventType,
      tokenAmount,
    });

    const userRef = admin.firestore().doc(`users/${uid}`);
    const batch = admin.firestore().batch();
    const txnRef = db.collection(`users/${uid}/transactions`).doc();

    batch.set(txnRef, {
      amount,
      eventType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (eventType === 'subscription') {
      batch.set(userRef, { isSubscribed: true }, { merge: true });
    } else if (eventType === 'token') {
      batch.set(
        userRef,
        { tokens: admin.firestore.FieldValue.increment(tokenAmount) },
        { merge: true },
      );
    }

    await batch.commit();
    functions.logger.info('Transaction logged successfully');
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
          functions.logger.info('Handling payment_intent.succeeded', {
            id: pi.id,
          });

          const metadata = pi.metadata || {};
          const uid = metadata.uid as string | undefined;
          const productType = metadata.productType as string | undefined;
          const tokenAmount = metadata.tokenAmount as string | undefined;
          functions.logger.info('PaymentIntent metadata', metadata);

          if (!uid || !productType) {
            functions.logger.error(
              'Missing uid or productType in PaymentIntent metadata',
              {
                uid,
                productType,
              },
            );
            break;
          }

          if (productType === 'subscription') {
            const amount = pi.amount_received || 0;
            functions.logger.info(`Activating subscription for ${uid}`);
            await logTransaction(uid, amount, 'subscription');
          } else if (productType === 'token') {
            const tokens = parseInt(tokenAmount || '0', 10);
            if (isNaN(tokens) || tokens <= 0) {
              functions.logger.error('Invalid tokenAmount in PaymentIntent metadata', {
                uid,
                tokenAmount,
              });
              break;
            }
            const amount = pi.amount_received || 0;
            functions.logger.info(`Adding ${tokens} tokens to ${uid}`);
            await logTransaction(uid, amount, 'token', tokens);
          } else {
            functions.logger.error('Unknown productType in PaymentIntent', {
              productType,
            });
          }
          break;
        }
        case 'setup_intent.succeeded': {
          const si = event.data.object as Stripe.SetupIntent;
          functions.logger.info('Handling setup_intent.succeeded', { id: si.id });

          const metadata = si.metadata || {};
          const uid = metadata.uid as string | undefined;
          const productType = metadata.productType as string | undefined;
          const tokenAmount = metadata.tokenAmount as string | undefined;
          functions.logger.info('SetupIntent metadata', metadata);

          if (!uid || !productType) {
            functions.logger.error('Missing uid or productType in SetupIntent metadata', {
              uid,
              productType,
            });
            break;
          }

          if (productType === 'subscription') {
            functions.logger.info(`Activating subscription for ${uid}`);
            await logTransaction(uid, 0, 'subscription');
          } else if (productType === 'token') {
            const tokens = parseInt(tokenAmount || '0', 10);
            if (isNaN(tokens) || tokens <= 0) {
              functions.logger.error('Invalid tokenAmount in SetupIntent metadata', {
                uid,
                tokenAmount,
              });
              break;
            }
            functions.logger.info(`Adding ${tokens} tokens to ${uid}`);
            await logTransaction(uid, 0, 'token', tokens);
          } else {
            functions.logger.error('Unknown productType in SetupIntent', {
              productType,
            });
          }
          break;
        }
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionCancel(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          const metadata = invoice.metadata || {};
          const uid = metadata.uid as string | undefined;
          const productType = metadata.productType as string | undefined;
          functions.logger.info('Invoice metadata', metadata);

          if (!uid || !productType) {
            functions.logger.error('Missing uid or productType in Invoice metadata', {
              uid,
              productType,
            });
            break;
          }

          if (productType === 'subscription') {
            const amount = invoice.amount_paid || 0;
            await logTransaction(uid, amount, 'subscription');
          } else {
            functions.logger.error('Unknown productType in Invoice', { productType });
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
