import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' } as any);

async function lookupUidByCustomerId(customerId: string): Promise<string | null> {
  const snap = await firestore.doc(`stripeCustomers/${customerId}`).get();
  return snap.exists ? (snap.data()?.uid ?? null) : null;
}

async function handleTokenPurchase(session: Stripe.Checkout.Session) {
  const uid = session.metadata?.uid;
  const tokenAmount = Number(session.metadata?.tokenAmount);
  console.log('handleTokenPurchase', { uid, tokenAmount, sessionId: session.id });
  if (!uid || !Number.isFinite(tokenAmount)) {
    console.error('handleTokenPurchase missing data', { uid, tokenAmount });
    return;
  }

  await firestore.runTransaction(async (tx) => {
    const userRef = firestore.doc(`users/${uid}`);
    tx.update(userRef, { tokens: admin.firestore.FieldValue.increment(tokenAmount) });
    const purchaseRef = firestore.doc(`transactions/${uid}/purchases/${session.id}`);
    tx.set(
      purchaseRef,
      {
        type: 'tokens',
        amount: tokenAmount,
        total: session.amount_total ?? null,
        currency: session.currency ?? null,
        sessionId: session.id,
        paymentIntentId: session.payment_intent ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function upsertSubscriptionFromStripe(
  input: Stripe.Subscription | { id: string; customer: string }
) {
  const sub: Stripe.Subscription =
    'items' in input
      ? (input as Stripe.Subscription)
      : await stripe.subscriptions.retrieve(input.id as string);
  const customerId = (sub.customer as string) || '';
  const uid = sub.metadata?.uid || (await lookupUidByCustomerId(customerId));
  if (!uid) {
    console.error('upsertSubscriptionFromStripe missing uid', {
      subscriptionId: sub.id,
      customerId,
    });
    return;
  }

  const price = sub.items?.data?.[0]?.price;
  const status = sub.status;
  const isSubscribed = status === 'active' || status === 'trialing';

  await firestore.runTransaction(async (tx) => {
    tx.set(
      firestore.doc(`subscriptions/${uid}`),
      {
        subscriptionId: sub.id,
        customerId,
        status,
        priceId: price?.id ?? null,
        planNickname: price?.nickname ?? null,
        current_period_start: (sub as any).current_period_start
          ? new Date((sub as any).current_period_start * 1000).toISOString()
          : null,
        current_period_end: (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      firestore.doc(`users/${uid}`),
      { isSubscribed },
      { merge: true }
    );
  });

  console.log('upsertSubscriptionFromStripe', {
    uid,
    status,
    subscriptionId: sub.id,
  });
}

export const handleStripeWebhookV2 = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('Missing stripe-signature header');
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log('Webhook event received', { type: event.type, id: event.id });

  const idRef = firestore.doc(`webhookEvents/${event.id}`);
  let alreadyProcessed = false;
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(idRef);
    if (snap.exists) alreadyProcessed = true;
    else
      tx.set(idRef, {
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        type: event.type,
      });
  });

  if (alreadyProcessed) {
    console.log('Idempotency hit', { eventId: event.id });
    res.status(200).send('[ok] duplicate');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'payment' && session.metadata?.purpose === 'tokens') {
          await handleTokenPurchase(session);
        } else if (session.mode === 'subscription') {
          await upsertSubscriptionFromStripe({
            id: session.subscription as string,
            customer: session.customer as string,
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(sub);
        break;
      }
      default:
        console.log('Unhandled event type', event.type);
    }

    res.status(200).send('[ok]');
  } catch (err) {
    console.error('Error processing webhook', { error: err, type: event.type, id: event.id });
    res.status(500).send('Webhook handler failed');
  }
});

export const handleStripeWebhook = handleStripeWebhookV2;
