import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { env } from '@core/env';
import { STRIPE_SECRET_KEY } from '@core/secrets';
import { addTokens } from './utils';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const tsFromUnix = (n?: number) =>
  n ? admin.firestore.Timestamp.fromMillis(n * 1000) : null;

async function findUidByCustomer(customer: any): Promise<string | null> {
  const customerId = typeof customer === 'string' ? customer : customer?.id;
  if (!customerId) return null;
  const snap = await firestore
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

const upsertSubscriptionFromStripe = async (sub: Stripe.Subscription) => {
  let uid = sub.metadata?.uid || (await findUidByCustomer(sub.customer));
  if (!uid) {
    console.warn('Missing uid in subscription', { subscriptionId: sub.id });
    return;
  }
  const status = sub.status;
  const active = {
    subscriptionId: sub.id,
    status,
    currentPeriodStart: tsFromUnix((sub as any).current_period_start),
    currentPeriodEnd: tsFromUnix((sub as any).current_period_end),
    tier: sub.metadata?.tier || null,
  };
  await firestore
    .doc(`subscriptions/${uid}`)
    .set({ active, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  const isActive = status === 'active' || status === 'trialing';
  await firestore.doc(`users/${uid}`).set({ isSubscribed: isActive }, { merge: true });
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
        const obj = event.data.object as Stripe.Checkout.Session;
        let uid = obj.metadata?.uid || (await findUidByCustomer(obj.customer));
        if (!uid) {
          console.warn('Missing uid for checkout.session.completed', {
            eventType: event.type,
            sessionId: obj.id,
          });
          res.sendStatus(200);
          return;
        }
        if (obj.mode === 'subscription') {
          if (obj.subscription) {
            const sub = await stripe.subscriptions.retrieve(obj.subscription as string);
            await upsertSubscriptionFromStripe(sub);
          }
          await firestore
            .doc(`users/${uid}`)
            .set(
              {
                isSubscribed: true,
                subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
        } else if (obj.mode === 'payment' && obj.metadata?.tokens) {
          const tokens = Number(obj.metadata.tokens);
          if (tokens > 0) {
            await addTokens(uid, tokens);
            const txId =
              typeof obj.payment_intent === 'string'
                ? obj.payment_intent
                : obj.id;
            await firestore
              .doc(`users/${uid}/transactions/${txId}`)
              .set(
                {
                  type: 'tokens',
                  amount: tokens,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
          }
        }
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
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const uid = invoice.metadata?.uid || (await findUidByCustomer(invoice.customer));
      if (!uid) {
        console.warn('Missing uid for invoice.paid', { invoiceId: invoice.id });
        res.sendStatus(200);
        return;
      }
      const tokensRaw = invoice.metadata?.tokens;
      const tokens = tokensRaw ? Number(tokensRaw) : NaN;
      if (tokens > 0) {
        await addTokens(uid, tokens);
        const txId = invoice.payment_intent
          ? String(invoice.payment_intent)
          : invoice.id;
        await firestore
          .doc(`users/${uid}/transactions/${txId}`)
          .set(
            {
              type: 'tokens',
              amount: tokens,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      } else {
        console.log('invoice.paid with no tokens', { invoiceId: invoice.id });
      }
      res.sendStatus(200);
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

