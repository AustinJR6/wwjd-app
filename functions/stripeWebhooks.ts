import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
} as any);

const tsFromUnix = (n?: number) =>
  n ? admin.firestore.Timestamp.fromMillis(n * 1000) : null;

export const upsertSubscriptionFromStripe = async (sub: Stripe.Subscription) => {
  let uid = sub.metadata?.uid as string | undefined;
  if (!uid) {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    try {
      const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
      uid = customer.metadata?.uid;
    } catch (e) {
      console.warn('Failed to retrieve customer for subscription', {
        subscriptionId: sub.id,
        customerId,
      });
    }
  }
  if (!uid) {
    console.warn('Missing uid in subscription', { subscriptionId: sub.id });
    return;
  }
  const status = sub.status;
  const price = sub.items.data[0]?.price;
  const priceId = price?.id || null;
  const productId =
    price && typeof price.product === 'string'
      ? price.product
      : ((price?.product as Stripe.Product)?.id || null);
  const isActive = status === 'active' || status === 'trialing';
  const doc = {
    status,
    subscriptionId: sub.id,
    currentPeriodEnd: tsFromUnix((sub as any).current_period_end),
    productId,
    priceId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive,
  };
  await firestore.doc(`subscriptions/${uid}`).set(doc, { merge: true });
  await firestore.doc(`users/${uid}`).set({ isSubscribed: isActive }, { merge: true });
  console.log(
    `sub.sync uid=${uid} sub=${sub.id} status=${status} periodEnd=${(sub as any).current_period_end}`,
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
  const tokenAmountRaw =
    intent.metadata?.tokenAmount ?? intent.metadata?.tokens ?? '0';
  const tokenAmount = Number(tokenAmountRaw);
  if (!uid || !Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    console.warn('Token handler: missing uid or invalid token amount', {
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

  console.log('Token handler: credited tokens', {
    uid,
    tokenAmount,
    id: intent.id,
  });
}

// Webhook handler
export const handleStripeWebhookV2 = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    console.error('Missing stripe-signature header');
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
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
        const uid = session.client_reference_id || session.metadata?.uid;
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
    case 'invoice.payment_succeeded': {
      try {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subId) {
          console.warn('Invoice without subscription', {
            eventType: event.type,
            invoiceId: invoice.id,
          });
          res.sendStatus(200);
          return;
        }
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ['items.data.price'],
        });
        await upsertSubscriptionFromStripe(sub);
        res.sendStatus(200);
      } catch (err) {
        console.error('Error in invoice.payment_succeeded', {
          error: err,
          eventType: event.type,
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

