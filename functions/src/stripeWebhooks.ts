import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

async function lookupUidByCustomerId(customerId: string): Promise<string | null> {
  const snap = await firestore.doc(`stripeCustomers/${customerId}`).get();
  return snap.exists ? (snap.data()?.uid ?? null) : null;
}

async function handleTokenPurchase(session: Stripe.Checkout.Session) {
  const uid = session.metadata?.uid;
  const tokenAmount = Number(session.metadata?.tokenAmount);
  console.log('[stripe] handleTokenPurchase', { uid, tokenAmount, sessionId: session.id });
  if (!uid || !Number.isFinite(tokenAmount)) {
    console.error('[stripe] handleTokenPurchase missing data', { uid, tokenAmount });
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
    console.error('[stripe] upsertSubscriptionFromStripe missing uid', {
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

  console.log('[stripe] upsertSubscriptionFromStripe', {
    uid,
    status,
    subscriptionId: sub.id,
  });
}

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const ref = firestore.collection('webhookEvents').doc(eventId);
  const doc = await ref.get();
  return doc.exists;
}

async function markProcessed(eventId: string): Promise<void> {
  const ref = firestore.collection('webhookEvents').doc(eventId);
  await ref.set({ processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

const app = express();
app.use(express.raw({ type: 'application/json' }));
app.get('/', (_req, res) => res.status(200).send('ok'));

app.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[stripe] signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (await alreadyProcessed(event.id)) {
      return res.status(200).send('[OK-duplicate]');
    }
  } catch (e) {
    console.error('[stripe] idempotency check failed', e);
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
          const uid =
            session.metadata?.uid || (await lookupUidByCustomerId(session.customer as string));
          if (uid) {
            await firestore.doc(`users/${uid}`).set(
              {
                stripeSubscriptionId: String(session.subscription ?? ''),
                subscriptionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const uid =
          invoice.metadata?.uid || (await lookupUidByCustomerId(invoice.customer as string));
        if (uid) {
          await firestore.doc(`users/${uid}`).set(
            {
              isSubscribed: true,
              lastInvoiceId: invoice.id,
              lastInvoicePaidAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        const subscriptionId = (invoice as any).subscription as string | undefined;
        if (subscriptionId) {
          await upsertSubscriptionFromStripe({
            id: subscriptionId,
            customer: invoice.customer as string,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(sub);
        const uid = sub.metadata?.uid || (await lookupUidByCustomerId(sub.customer as string));
        if (uid) {
          await firestore.doc(`users/${uid}`).set(
            {
              isSubscribed: false,
              subscriptionEndedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const uid = pi.metadata?.uid;
        const tokenAmount = Number(pi.metadata?.tokenAmount);
        if (uid && Number.isFinite(tokenAmount) && tokenAmount > 0) {
          await firestore.doc(`users/${uid}`).set(
            {
              tokens: admin.firestore.FieldValue.increment(tokenAmount),
              tokensLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }

      default:
        break;
    }

    await markProcessed(event.id);
    return res.status(200).send('[OK]');
  } catch (err) {
    console.error('[stripe] handler error', err);
    return res.status(500).send('Internal');
  }
});

export const handleStripeWebhookV2 = functions
  .region('us-central1')
  .https.onRequest(app);
