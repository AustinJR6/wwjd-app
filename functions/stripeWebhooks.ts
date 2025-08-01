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
    return stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: any) {
    functions.logger.error('Webhook signature verification failed', err);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return null;
  }
}

export const handleSubscriptionWebhook = functions.https.onRequest(
  async (req: RawBodyRequest, res: Response) => {
    const event = verifyEvent(req, res);
    if (!event) return;

    functions.logger.debug('Stripe event received', {
      type: event.type,
      id: event.id,
      payload: event.data?.object,
    });

    if (event.type !== 'checkout.session.completed') {
      functions.logger.warn('Unsupported event type', { type: event.type });
      res.status(400).json({ error: 'Unsupported event' });
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const uid =
      (session.client_reference_id as string) || (session.metadata?.uid as string) || '';
    functions.logger.debug('Parsed checkout session metadata', {
      uid,
      metadata: session.metadata,
    });
    if (!uid) {
      res.status(400).json({ error: 'UID missing' });
      return;
    }

    try {
      functions.logger.info('Updating subscription status in Firestore', { uid });
      await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
      functions.logger.info('Subscription status updated', { uid });
      res.status(200).json({ received: true });
    } catch (err: any) {
      functions.logger.error('Failed to update subscription status', err);
      res.status(500).json({ error: 'Internal error' });
    }
  },
);

export const handleTokenPurchaseWebhook = functions.https.onRequest(
  async (req: RawBodyRequest, res: Response) => {
    const event = verifyEvent(req, res);
    if (!event) return;

    functions.logger.debug('Stripe event received', {
      type: event.type,
      id: event.id,
      payload: event.data?.object,
    });

    if (event.type !== 'checkout.session.completed') {
      functions.logger.warn('Unsupported event type', { type: event.type });
      res.status(400).json({ error: 'Unsupported event' });
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const uid = (session.metadata?.uid as string) || '';
    const tokensStr = (session.metadata?.tokens as string) || '0';
    const tokens = parseInt(tokensStr, 10);
    functions.logger.debug('Parsed checkout session metadata', {
      uid,
      tokens,
      metadata: session.metadata,
    });
    if (!uid || !tokens) {
      res.status(400).json({ error: 'Missing uid or tokens' });
      return;
    }

    try {
      functions.logger.info('Updating user tokens', { uid, tokens });
      await db.doc(`users/${uid}`).set(
        { tokens: admin.firestore.FieldValue.increment(tokens) },
        { merge: true },
      );
      functions.logger.info('Token balance updated', { uid, tokens });
      res.status(200).json({ received: true });
    } catch (err: any) {
      functions.logger.error('Failed to update tokens', err);
      res.status(500).json({ error: 'Internal error' });
    }
  },
);
