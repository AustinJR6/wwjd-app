import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
} as any);

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

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'invoice.paid'
    ) {
      const object: any = event.data.object;
      const customerId = object.customer as string | undefined;
      if (!customerId) {
        console.error(`Missing customer on event ${event.type}`);
        res.status(400).send('Missing customer');
        return;
      }

      const customer = await stripe.customers.retrieve(customerId);
      if ((customer as Stripe.Customer).deleted) {
        console.error(`Customer ${customerId} is deleted`);
        res.status(400).send('Customer deleted');
        return;
      }

      const uid = (customer as Stripe.Customer).metadata?.uid as
        | string
        | undefined;
      if (!uid) {
        console.error(`UID missing in customer metadata for ${customerId}`);
        res.status(400).send('Missing UID');
        return;
      }

      const purchaseType = object.metadata?.type as string | undefined;

      if (purchaseType === 'subscription') {
        await processSubscription(event.type, object, uid);
      } else if (purchaseType === 'token' || purchaseType === 'token_purchase') {
        const tokenAmount = Number(object.metadata?.tokenAmount || 0);
        const stripeTransactionId =
          (object.payment_intent as string | undefined) ||
          (object.id as string);
        await processTokenPurchase(uid, tokenAmount, stripeTransactionId);
      } else {
        console.log(`Unhandled purchase type: ${purchaseType}`);
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    console.log('Webhook handled successfully');
    res.status(200).send('Webhook handled');
  } catch (err) {
    console.error('Error processing webhook', err);
    res.status(500).send('Internal Server Error');
  }
});

async function processSubscription(
  eventType: string,
  object: any,
  uid: string
) {
  const userRef = firestore.collection('users').doc(uid);
  const subRef = firestore.collection('subscriptions').doc(uid);

  let amount = 0;
  let subscriptionId: string | undefined;
  if (eventType === 'invoice.paid') {
    amount = object.amount_paid || 0;
    subscriptionId = object.subscription as string | undefined;
  } else if (eventType === 'checkout.session.completed') {
    amount = object.amount_total || 0;
    subscriptionId = object.subscription as string | undefined;
  }

  let expiresAt: admin.firestore.Timestamp | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEnd = (sub as any).current_period_end as number | undefined;
      if (periodEnd) {
        expiresAt = admin.firestore.Timestamp.fromMillis(periodEnd * 1000);
      }
    } catch (err) {
      console.error(`Failed to retrieve subscription ${subscriptionId}`, err);
    }
  }

  const subData = {
    active: true,
    tier: object.metadata?.tier || 'premium',
    subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expiresAt || null,
    updatedVia: 'stripeWebhook',
  };
  await subRef.set(subData, { merge: true });

  const userData = {
    isSubscribed: true,
    lastActive: admin.firestore.FieldValue.serverTimestamp(),
  };
  await userRef.set(userData, { merge: true });

  await userRef.collection('transactions').add({
    type: 'subscription',
    amount,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    description: 'WWJD+ Subscription',
  });

  console.log(`Subscription processed for UID: ${uid}`);
}

async function processTokenPurchase(
  uid: string,
  tokenAmount: number,
  stripeTransactionId?: string,
) {
  const userRef = firestore.collection('users').doc(uid);
  await firestore.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const data = snap.data();
    if (!snap.exists || typeof data?.tokens !== 'number') {
      t.set(userRef, { tokens: 0 }, { merge: true });
    }

    t.set(
      userRef,
      { tokens: admin.firestore.FieldValue.increment(tokenAmount) },
      { merge: true },
    );

    const txRef = userRef.collection('transactions').doc();
    t.set(txRef, {
      type: 'tokenPurchase',
      amount: tokenAmount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      stripeTransactionId: stripeTransactionId || null,
    });
  });

  console.log(`Token purchase processed for UID: ${uid}`);
}

