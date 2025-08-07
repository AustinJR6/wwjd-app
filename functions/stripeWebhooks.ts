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

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoice(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    console.log('Webhook handled successfully');
    res.status(200).send('Webhook handled');
  } catch (err) {
    console.error('Error processing webhook', err);
    res.status(500).send('Internal Server Error');
  }
});

// Handle payment intents for one-time token purchases
async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  const purchaseType = intent.metadata?.purchaseType || intent.metadata?.type;
  if (purchaseType !== 'token') {
    console.log(`Unhandled purchase type on payment intent: ${purchaseType}`);
    return;
  }

  if (intent.status !== 'succeeded') {
    console.log(`Ignoring payment intent with status: ${intent.status}`);
    return;
  }

  const uid = intent.metadata?.uid;
  const tokenAmount = Number(
    intent.metadata?.tokenAmount || intent.metadata?.tokens || 0
  );

  if (!uid) {
    console.error('UID missing in payment intent metadata');
    return;
  }

  if (!tokenAmount) {
    console.error('tokenAmount missing or zero in payment intent metadata');
    return;
  }

  const amount = intent.amount_received || intent.amount || 0;
  const currency = intent.currency || 'usd';
  try {
    await processTokenPurchase(uid, tokenAmount, amount, currency, intent.id);
  } catch (err) {
    console.error('Failed to process token purchase', err);
  }
}

// Handle invoices for subscription activations
async function handleInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | undefined;
  let uid: string | undefined;
  let tier: string | undefined;

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId as string
      );
      uid = subscription.metadata?.uid || uid;
      tier = subscription.metadata?.tier || tier;
    } catch (err) {
      console.error(`Failed to retrieve subscription ${subscriptionId}`, err);
    }
  }

  if (!uid && invoice.customer) {
    try {
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as Stripe.Customer).id;
      const customer = await stripe.customers.retrieve(customerId);
      if (!(customer as Stripe.Customer).deleted) {
        uid = (customer as Stripe.Customer).metadata?.uid || uid;
        tier = tier || (customer as Stripe.Customer).metadata?.tier;
      }
    } catch (err) {
      console.error(`Failed to retrieve customer ${invoice.customer}`, err);
    }
  }

  if (!uid) {
    console.error('UID missing in invoice metadata');
    return;
  }
  if (invoice.status !== 'paid') {
    console.log(`Invoice ${invoice.id} not paid yet; status: ${invoice.status}`);
    return;
  }

  const amount = invoice.amount_paid || 0;
  const currency = invoice.currency || 'usd';
  const finalTier = tier || 'premium';
  if (!tier) {
    console.warn(`Tier missing in invoice ${invoice.id}, defaulting to 'premium'`);
  }

  try {
    await processSubscription(
      uid as string,
      finalTier,
      amount,
      currency,
      invoice.id as string
    );
  } catch (err) {
    console.error('Failed to process subscription', err);
  }
}

// Handle updates to existing subscriptions
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.uid;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const tier = subscription.metadata?.tier || 'plus';

  if (!uid) {
    console.error('Missing uid in subscription metadata.');
    return;
  }

  console.log(
    `Processing subscription update for UID: ${uid}, status: ${status}`
  );

  if (status === 'active') {
    const userRef = firestore.doc(`users/${uid}`);
    const subRef = firestore.doc(`subscriptions/${uid}/active`);

    await userRef.set(
      {
        isSubscribed: true,
        subscriptionTier: tier,
        lastSubscriptionUpdate: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Updated user profile for UID: ${uid}`);

    await subRef.set(
      {
        subscriptionId,
        tier,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Updated subscription doc for UID: ${uid}`);

    const invoiceId = subscription.latest_invoice as string | undefined;
    if (invoiceId) {
      const txnRef = firestore.doc(`users/${uid}/transactions/${invoiceId}`);
      await txnRef.set(
        {
          status: 'complete',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(
        `Marked transaction ${invoiceId} as complete for UID: ${uid}`
      );
    }
  } else {
    console.log(`Subscription status is not active: ${status}`);
  }
}

// Subscription handler
async function processSubscription(
  uid: string,
  tier: string,
  amount: number,
  currency: string,
  invoiceId: string
) {
  const subRef = firestore.collection('subscriptions').doc(uid);
  const userRef = firestore.collection('users').doc(uid);

  await withRetry(async () => {
    await firestore.runTransaction(async (t) => {
      t.set(
        subRef,
        {
          active: true,
          tier,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(userRef, { isSubscribed: true }, { merge: true });

      const txRef = userRef.collection('transactions').doc(invoiceId);
      t.set(
        txRef,
        {
          type: 'subscription',
          amount,
          currency,
          tier,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  });

  console.log(`Subscription processed for UID: ${uid}`);
}

// Token purchase handler
async function processTokenPurchase(
  uid: string,
  tokenAmount: number,
  amount: number,
  currency: string,
  stripeTransactionId: string
) {
  const userRef = firestore.collection('users').doc(uid);
  await withRetry(async () => {
    await firestore.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const data = snap.data();
      if (!snap.exists || typeof data?.tokens !== 'number') {
        t.set(userRef, { tokens: 0 }, { merge: true });
      }

      t.set(
        userRef,
        { tokens: admin.firestore.FieldValue.increment(tokenAmount) },
        { merge: true }
      );

      const txRef = userRef.collection('transactions').doc(stripeTransactionId);
      t.set(
        txRef,
        {
          type: 'token',
          amount,
          currency,
          tokenAmount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  });

  console.log(`Token purchase processed for UID: ${uid}`);
}

async function withRetry(operation: () => Promise<void>, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await operation();
      return;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      console.error(`Firestore operation failed (attempt ${attempt + 1})`, err);
      await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
    }
  }
}
