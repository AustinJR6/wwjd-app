import { onRequest } from 'firebase-functions/v2/https';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './params';
import { getStripe } from './stripeClient';
import * as admin from 'firebase-admin';

const db = admin.firestore();

async function creditTokensIfTokenPack(event: any) {
  // Supports payment_intent.succeeded OR checkout.session.completed
  const stripe = getStripe();

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const uid = pi.metadata?.uid;
    const tokens = Number(pi.metadata?.tokens || 0);
    const paymentId = pi.id;

    if (!uid || !tokens) return;

    const txRef = db.doc(`users/${uid}/transactions/${paymentId}`);
    const txSnap = await txRef.get();
    if (txSnap.exists) {
      console.info('tokens.credit.skip.idempotent', { uid, paymentId });
      return;
    }

    await txRef.set({
      amount: pi.amount_received, currency: pi.currency, tokens,
      provider: 'stripe', createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'token_pack',
    }, { merge: true });

    await db.doc(`users/${uid}`).set({
      tokens: admin.firestore.FieldValue.increment(tokens),
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.info('tokens.credit', { uid, tokens, paymentId });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const paymentId = session.id;

    // If using Checkout for token packs, retrieve line items to find tokens
    if (!uid) return;

    const txRef = db.doc(`users/${uid}/transactions/${paymentId}`);
    const txSnap = await txRef.get();
    if (txSnap.exists) {
      console.info('tokens.credit.skip.idempotent', { uid, paymentId });
      return;
    }

    // Example: tokens encoded in metadata
    const tokens = Number(session.metadata?.tokens || 0);
    if (!tokens) return;

    await txRef.set({
      amount: session.amount_total, currency: session.currency, tokens,
      provider: 'stripe', createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'token_pack',
    }, { merge: true });

    await db.doc(`users/${uid}`).set({
      tokens: admin.firestore.FieldValue.increment(tokens),
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.info('tokens.credit.checkout', { uid, tokens, paymentId });
  }
}

async function syncSubscriptionFromStripe(sub: any) {
  const uid = sub.metadata?.uid;
  if (!uid) {
    // Try to derive uid from customer metadata
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(sub.customer);
    if ((customer as any)?.metadata?.uid) {
      sub.metadata = sub.metadata || {};
      sub.metadata.uid = (customer as any).metadata.uid;
    }
  }
  if (!sub.metadata?.uid) return;

  const status = sub.status;
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

  await db.doc(`subscriptions/${sub.metadata.uid}`).set({
    subscriptionId: sub.id,
    status,
    currentPeriodEnd,
    productId: sub.items?.data?.[0]?.price?.product || null,
    priceId: sub.items?.data?.[0]?.price?.id || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: ['active', 'trialing'].includes(status),
  }, { merge: true });

  await db.doc(`users/${sub.metadata.uid}`).set({
    isSubscribed: ['active', 'trialing'].includes(status),
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.info('sub.sync', { uid: sub.metadata.uid, subId: sub.id, status });
}

export const handleStripeWebhookV2 = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], cors: true },
  async (req, res) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) { res.status(400).send('Missing signature'); return; }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
      console.error('webhook.verify.error', err?.message || err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await syncSubscriptionFromStripe(event.data.object);
          break;

        case 'invoice.payment_succeeded': {
          // Renewal → keep subs in sync (sometimes you may want to expand subscription or fetch)
          const invoice: any = event.data.object;
          if (invoice.subscription) {
            const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
            await syncSubscriptionFromStripe(sub);
          }
          break;
        }

        case 'payment_intent.succeeded':
        case 'checkout.session.completed':
          await creditTokensIfTokenPack(event);
          break;

        default:
          // no-op
          console.info('webhook.unhandled', { type: event.type });
      }
      res.json({ received: true });
      return;
    } catch (err: any) {
      console.error('webhook.handler.error', event?.type, err?.message || err);
      res.status(500).send('Webhook handler error');
      return;
    }
  }
);

export async function creditTokenPurchase({ uid, tokens, amount, paymentId }: { uid: string; tokens: number; amount: number; paymentId: string }) {
  const txRef = db.doc(`users/${uid}/transactions/${paymentId}`);
  const txSnap = await txRef.get();
  if (txSnap.exists) return;
  await txRef.set({
    amount,
    currency: 'usd',
    tokens,
    provider: 'stripe',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    type: 'token_pack',
  }, { merge: true });
  await db.doc(`users/${uid}`).set({
    tokens: admin.firestore.FieldValue.increment(tokens),
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}
