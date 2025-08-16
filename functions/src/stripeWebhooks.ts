import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { env } from '@core/env';
import { STRIPE_SECRET_KEY } from '@core/secrets';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();


const tsFromUnix = (n?: number) =>
  n ? admin.firestore.Timestamp.fromMillis(n * 1000) : null;

const upsertSubscriptionFromStripe = async (sub: Stripe.Subscription) => {
  const uid = sub.metadata?.uid;
  if (!uid) {
    console.warn('Missing uid in subscription', { subscriptionId: sub.id });
    return;
  }
  const status = sub.status;
  const doc = {
    status,
    subscriptionId: sub.id,
    currentPeriodStart: tsFromUnix((sub as any).current_period_start),
    currentPeriodEnd: tsFromUnix((sub as any).current_period_end),
    invoiceId:
      typeof sub.latest_invoice === 'string'
        ? sub.latest_invoice
        : sub.latest_invoice?.id || null,
    tier: sub.metadata?.tier || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await firestore.doc(`subscriptions/${uid}`).set(doc, { merge: true });
  const isActive = status === 'active' || status === 'trialing';
  await firestore.doc(`users/${uid}`).set(
    {
      isSubscribed: isActive,
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

async function handleTokenPurchase(intent: Stripe.PaymentIntent) {
  const purchaseType =
    (intent.metadata?.purchaseType || intent.metadata?.type || '').toLowerCase();
  if (purchaseType !== 'token' && purchaseType !== 'tokens') {
    console.log('Token handler: ignoring non-token intent', {
      type: purchaseType,
      id: intent.id,
    });
    return;
  }

  const uid = intent.metadata?.uid;
  if (!uid) {
    console.warn('Token handler: missing uid', { id: intent.id });
    return;
  }

  const tokenAmountRaw = intent.metadata?.tokens ?? '0';
  const tokenAmount = Number(tokenAmountRaw);
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    console.warn('Token handler: invalid token amount', {
      uid,
      tokenAmountRaw,
      id: intent.id,
    });
    return;
  }

  const userRef = firestore.doc(`users/${uid}`);
  const txRef = userRef.collection('transactions').doc(intent.id);

  await firestore.runTransaction(async (t) => {
    const existing = await t.get(txRef);
    if (existing.exists) {
      console.log('Token handler: transaction already recorded, skipping increment', {
        id: intent.id,
        uid,
      });
      return;
    }
    t.set(userRef, { tokens: admin.firestore.FieldValue.increment(tokenAmount) }, { merge: true });
    t.set(
      txRef,
      {
        type: 'tokens',
        amount: tokenAmount,
        currency: intent.currency || 'usd',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  console.log('Token handler: credited tokens', { uid, tokenAmount });
}

// Webhook handler
export const handleStripeWebhookV2 = functions
  .runWith({ secrets: [STRIPE_SECRET_KEY] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      console.error('Missing stripe-signature header');
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2023-10-16' } as any);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.get('STRIPE_WEBHOOK_SECRET')
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed.', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

  switch (event.type) {
    case 'checkout.session.completed': {
      try {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.uid;
        if (!uid) {
          console.warn('Missing uid for checkout.session.completed', {
            eventType: event.type,
            sessionId: session.id,
          });
          res.sendStatus(200);
          return;
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        await firestore.doc(`subscriptions/${uid}`).set(
          {
            status: 'active',
            sessionId: session.id,
            subscribedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
        await firestore.doc(`users/${uid}`).set(
          { isSubscribed: true, lastActive: now },
          { merge: true }
        );
        res.sendStatus(200);
      } catch (err) {
        console.error('Error in checkout.session.completed', {
          error: err,
          eventType: event.type,
          sessionId: (event.data.object as any)?.id,
        });
        res.sendStatus(400);
      }
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      try {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(sub);
        res.sendStatus(200);
      } catch (err) {
        console.error('Error in subscription event', {
          error: err,
          eventType: event.type,
          subscriptionId: (event.data.object as any)?.id,
        });
        res.sendStatus(400);
      }
      return;
    }
    case 'payment_intent.succeeded':
      await handleTokenPurchase(event.data.object as Stripe.PaymentIntent);
      res.sendStatus(200);
      return;
    default:
      console.log(`Unhandled event type: ${event.type}`);
      res.sendStatus(200);
      return;
  }
  });

