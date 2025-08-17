import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { env } from '@core/env';
import { STRIPE_SECRET_KEY } from '@core/secrets';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const tsFromSeconds = (s?: number | null) =>
  s ? admin.firestore.Timestamp.fromMillis(s * 1000) : null;

async function recordEvent(id: string): Promise<boolean> {
  const ref = db.collection('stripe_events').doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[idempotent] event ${id} already processed`);
    return false;
  }
  await ref.set({ processedAt: admin.firestore.FieldValue.serverTimestamp() });
  return true;
}

async function upsertSubscription(uid: string, sub: Stripe.Subscription) {
  await db
    .doc(`subscriptions/${uid}`)
    .set(
      {
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodStart: tsFromSeconds(sub.current_period_start),
        currentPeriodEnd: tsFromSeconds(sub.current_period_end),
        stripeCustomerId:
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      },
      { merge: true }
    );
  const active = sub.status === 'active' || sub.status === 'trialing';
  await db.doc(`users/${uid}`).set({ isSubscribed: active }, { merge: true });
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  const uid = intent.metadata?.userId || intent.metadata?.uid;
  const type = intent.metadata?.type?.toLowerCase();
  const tokenAmount = Number(
    intent.metadata?.tokenAmount || intent.metadata?.tokens || 0
  );
  if (!uid || type !== 'token' || !Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    return;
  }

  const userRef = db.doc(`users/${uid}`);
  const txRef = userRef.collection('transactions').doc(intent.id);

  await db.runTransaction(async (t) => {
    const existing = await t.get(txRef);
    if (existing.exists) return;
    t.set(
      userRef,
      { tokens: admin.firestore.FieldValue.increment(tokenAmount) },
      { merge: true }
    );
    t.set(
      txRef,
      {
        type: 'token',
        tokenAmount,
        status: 'succeeded',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe
) {
  const uid = session.metadata?.userId || session.client_reference_id || undefined;
  if (!uid) return;

  const txRef = db.doc(`users/${uid}/transactions/${session.id}`);
  await txRef.set(
    {
      type: 'subscription',
      status: 'paid',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (session.subscription) {
    const sub = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await upsertSubscription(uid, sub);
  }
}

async function handleSubscription(sub: Stripe.Subscription) {
  const uid =
    sub.metadata?.userId || sub.metadata?.uid || undefined;
  if (!uid) return;
  await upsertSubscription(uid, sub);
}

export const stripeWebhooks = functions
  .runWith({ secrets: [STRIPE_SECRET_KEY] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
      apiVersion: '2023-10-16',
    } as any);

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

    if (!(await recordEvent(event.id))) {
      res.send('[idempotent]');
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntent(event.data.object as Stripe.PaymentIntent);
          break;
        case 'checkout.session.completed':
          await handleCheckoutSession(
            event.data.object as Stripe.Checkout.Session,
            stripe
          );
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscription(event.data.object as Stripe.Subscription);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      res.sendStatus(200);
    } catch (err) {
      console.error('Error handling event', event.type, err);
      res.sendStatus(500);
    }
  });

