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

interface TokenPurchase {
  uid: string;
  tokens: number;
  amount: number;
  paymentId: string;
}

export async function creditTokenPurchase({
  uid,
  tokens,
  amount,
  paymentId,
}: TokenPurchase) {
  if (!uid || !Number.isFinite(tokens) || tokens <= 0) {
    console.error('Token purchase missing uid or tokens', {
      uid,
      tokens,
      paymentId,
    });
    return;
  }

  const userRef = firestore.doc(`users/${uid}`);
  const txRef = userRef.collection('transactions').doc(paymentId);

  await firestore.runTransaction(async (t) => {
    const existing = await t.get(txRef);
    if (existing.exists) {
      console.log('Token purchase already processed, skipping', {
        uid,
        paymentId,
      });
      return;
    }
    t.set(
      txRef,
      {
        amount,
        tokens,
        provider: 'stripe',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    t.set(
      userRef,
      {
        tokens: admin.firestore.FieldValue.increment(tokens),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  console.log(`tokens.credit uid=${uid} +${tokens}`);
}

async function extractTokenPurchase(
  event: Stripe.Event,
): Promise<TokenPurchase | null> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const meta = intent.metadata || {};
      if (meta.type === 'token_pack') {
        const uid = meta.uid;
        const tokens = Number(meta.tokens);
        const amount = intent.amount_received ?? intent.amount ?? 0;
        return uid && Number.isFinite(tokens) && tokens > 0
          ? { uid, tokens, amount, paymentId: intent.id }
          : null;
      }
      return null;
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      if (meta.type === 'token_pack') {
        const uid = meta.uid;
        const tokens = Number(meta.tokens);
        const amount = session.amount_total ?? 0;
        const paymentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent | null)?.id ||
              session.id;
        return uid && Number.isFinite(tokens) && tokens > 0
          ? { uid, tokens, amount, paymentId }
          : null;
      }
      try {
        const items = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price.product'],
        });
        for (const item of items.data) {
          const price = item.price as Stripe.Price;
          const product = price?.product as Stripe.Product;
          const priceMeta = price?.metadata || {};
          const productMeta = product?.metadata || {};
          if (
            priceMeta.type === 'token_pack' ||
            productMeta.type === 'token_pack'
          ) {
            const uid = meta.uid || productMeta.uid;
            const tokensStr = priceMeta.tokens || productMeta.tokens;
            const tokens = Number(tokensStr);
            const amount = item.amount_total ?? session.amount_total ?? 0;
            const paymentId =
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : (session.payment_intent as Stripe.PaymentIntent | null)?.id ||
                  session.id;
            return uid && Number.isFinite(tokens) && tokens > 0
              ? { uid, tokens, amount, paymentId }
              : null;
          }
        }
      } catch (e) {
        console.error('Failed to fetch line items for session', {
          sessionId: session.id,
          error: e,
        });
      }
      return null;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      };
      const meta = invoice.metadata || {};
      const paymentIntent = (invoice as any).payment_intent;
      if (meta.type === 'token_pack') {
        const uid = meta.uid;
        const tokens = Number(meta.tokens);
        const paymentId =
          typeof paymentIntent === 'string'
            ? paymentIntent
            : paymentIntent?.id || invoice.id;
        const amount = invoice.amount_paid ?? 0;
        return uid && Number.isFinite(tokens) && tokens > 0
          ? { uid, tokens, amount, paymentId }
          : null;
      }
      try {
        const inv = (await stripe.invoices.retrieve(invoice.id!, {
          expand: ['lines.data.price.product'],
        })) as any;
        for (const item of inv.lines.data as any[]) {
          const price = item.price as Stripe.Price;
          const product = price?.product as Stripe.Product;
          const priceMeta = price?.metadata || {};
          const productMeta = product?.metadata || {};
          if (
            priceMeta.type === 'token_pack' ||
            productMeta.type === 'token_pack'
          ) {
            const uid = meta.uid || productMeta.uid;
            const tokensStr = priceMeta.tokens || productMeta.tokens;
            const tokens = Number(tokensStr);
            const invPaymentIntent = (inv as any).payment_intent;
            const paymentId =
              typeof invPaymentIntent === 'string'
                ? invPaymentIntent
                : invPaymentIntent?.id || inv.id;
            const amount = inv.amount_paid ?? 0;
            return uid && Number.isFinite(tokens) && tokens > 0
              ? { uid, tokens, amount, paymentId }
              : null;
          }
        }
      } catch (e) {
        console.error('Failed to retrieve invoice line items', {
          invoiceId: invoice.id,
          error: e,
        });
      }
      return null;
    }
    default:
      return null;
  }
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

  const tokenPurchase = await extractTokenPurchase(event);
  if (tokenPurchase) {
    try {
      await creditTokenPurchase(tokenPurchase);
      res.sendStatus(200);
    } catch (err) {
      console.error('Error crediting token purchase', {
        error: err,
        eventType: event.type,
      });
      res.sendStatus(400);
    }
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
      res.sendStatus(200);
      return;
    default:
      console.log(`Unhandled event type: ${event.type}`);
      res.sendStatus(200);
      return;
  }
});

