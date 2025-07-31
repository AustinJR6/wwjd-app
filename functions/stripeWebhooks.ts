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
    res.status(400).send('Signature required');
    return null;
  }
  try {
    return stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return null;
  }
}

export const handleSubscriptionWebhook = functions.https.onRequest(
  async (req: RawBodyRequest, res: Response) => {
    const event = verifyEvent(req, res);
    if (!event) return;

    if (event.type !== 'checkout.session.completed') {
      res.status(400).send('Unsupported event');
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const uid = (session.client_reference_id as string) || (session.metadata?.uid as string) || '';
    if (!uid) {
      res.status(400).send('UID missing');
      return;
    }

    try {
      await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
      res.status(200).send({ received: true });
    } catch (err: any) {
      console.error('Failed to update subscription status', err);
      res.status(500).send('Internal error');
    }
  },
);

export const handleTokenPurchaseWebhook = functions.https.onRequest(
  async (req: RawBodyRequest, res: Response) => {
    const event = verifyEvent(req, res);
    if (!event) return;

    if (event.type !== 'checkout.session.completed') {
      res.status(400).send('Unsupported event');
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const uid = (session.metadata?.uid as string) || '';
    const tokensStr = (session.metadata?.tokens as string) || '0';
    const tokens = parseInt(tokensStr, 10);
    if (!uid || !tokens) {
      res.status(400).send('Missing uid or tokens');
      return;
    }

    try {
      await db.doc(`users/${uid}`).set(
        { tokens: admin.firestore.FieldValue.increment(tokens) },
        { merge: true },
      );
      res.status(200).send({ received: true });
    } catch (err: any) {
      console.error('Failed to update tokens', err);
      res.status(500).send('Internal error');
    }
  },
);
