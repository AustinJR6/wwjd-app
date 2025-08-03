import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
} as any);

export const handleStripeWebhookV2 = onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supportedEvents = [
    'setup_intent.succeeded',
    'payment_intent.succeeded',
    'invoice.paid',
  ];

  if (!supportedEvents.includes(event.type)) {
    console.log(`🔕 Unhandled event type: ${event.type}`);
    return res.status(200).send('Event ignored');
  }

  const object: any = event.data.object;
  const metadata = object.metadata || {};
  const uid = metadata.uid as string | undefined;
  const type = metadata.type as string | undefined;
  const tokenAmount = Number(metadata.tokenAmount || 0);

  if (!uid || !type) {
    console.warn('🚫 Missing metadata in event:', event.type);
    return res.status(400).send('Missing metadata');
  }

  const userRef = admin.firestore().collection('users').doc(uid);

  if (type === 'subscription') {
    console.log(`📬 Setting isSubscribed: true for UID: ${uid}`);
    await userRef.set({ isSubscribed: true }, { merge: true });
  } else if (type === 'token_purchase') {
    console.log(`💎 Adding ${tokenAmount} tokens for UID: ${uid}`);
    await userRef.set(
      { tokens: admin.firestore.FieldValue.increment(tokenAmount) },
      { merge: true }
    );
  } else {
    console.warn(`⚠️ Unrecognized metadata.type: ${type}`);
  }

  res.status(200).send('Webhook handled');
});

