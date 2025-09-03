import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const db = firestore;
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
    tx.set(userRef, { tokens: admin.firestore.FieldValue.increment(tokenAmount) }, { merge: true });
    const purchaseRef = firestore.doc(`users/${uid}/transactions/${session.id}`);
    tx.set(purchaseRef, {
      type: 'tokens',
      tokens: tokenAmount,
      total: session.amount_total ?? null,
      currency: session.currency ?? null,
      sessionId: session.id,
      paymentIntentId: session.payment_intent ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

// Resolve uid from a Checkout Session: prefer metadata.uid, then find by stored customerId
async function resolveUidFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  if (session.metadata?.uid) return session.metadata.uid as string;
  if (session.customer) {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
    // mapping first
    try {
      const mapSnap = await db.doc(`stripeCustomers/${customerId}`).get();
      const mapped = mapSnap.exists ? (mapSnap.data() as any)?.uid : null;
      if (mapped) return mapped as string;
    } catch {}
    const snap = await db.collection('users').where('subscription.customerId', '==', customerId).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
  }
  return null;
}

// Timestamp helper from seconds
function tsFromSec(sec?: number | null) {
  return sec ? admin.firestore.Timestamp.fromMillis(sec * 1000) : null;
}

// Add interval to a start time (ms) based on Stripe price cadence
function addInterval(startMs: number, interval: 'day'|'week'|'month'|'year', count = 1) {
  const d = new Date(startMs);
  if (interval === 'day')   d.setUTCDate(d.getUTCDate() + count);
  if (interval === 'week')  d.setUTCDate(d.getUTCDate() + 7 * count);
  if (interval === 'month') d.setUTCMonth(d.getUTCMonth() + count);
  if (interval === 'year')  d.setUTCFullYear(d.getUTCFullYear() + count);
  return d.getTime();
}

function derivePeriodFromPrice(opts: {
  startSec?: number | null,
  price?: Stripe.Price | null,
  eventCreatedSec?: number,
}) {
  const start = opts.startSec ?? opts.eventCreatedSec ?? Math.floor(Date.now()/1000);
  const rec = opts.price?.recurring;
  if (!rec) return { startTs: tsFromSec(start), endTs: null as admin.firestore.Timestamp | null };
  const endMs = addInterval(start * 1000, rec.interval as any, rec.interval_count ?? 1);
  return { startTs: tsFromSec(start), endTs: admin.firestore.Timestamp.fromMillis(endMs) };
}

async function writeSubscriptionTransaction(
  uid: string,
  session: Stripe.Checkout.Session,
  sub: Stripe.Subscription,
) {
  const ref = db.collection('users').doc(uid);
  const txRef = ref.collection('transactions').doc(session.id);
  const item = sub.items.data?.[0];
  const endSec = item?.current_period_end ?? null;
  const startSec = item?.current_period_start ?? null;
  const current_period_end = endSec ? admin.firestore.Timestamp.fromMillis(endSec * 1000) : null;
  const current_period_start = startSec ? admin.firestore.Timestamp.fromMillis(startSec * 1000) : null;

  const price = sub.items?.data?.[0]?.price;

  const txPayload = {
    type: 'subscription' as const,
    mode: 'subscription' as const,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutSessionId: session.id,
    customerId: sub.customer,
    subscriptionId: sub.id,
    status: sub.status,
    priceId: price?.id ?? null,
    quantity: sub.items?.data?.[0]?.quantity ?? 1,
    current_period_end,
    current_period_start,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    latest_invoice: sub.latest_invoice ?? null,
  };

  await db.runTransaction(async (t) => {
    t.set(txRef, txPayload, { merge: true });
    t.set(
      ref,
      {
        isSubscribed:
          sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due',
        subscription: {
          id: sub.id,
          status: sub.status,
          customerId: sub.customer,
          priceId: price?.id ?? null,
          current_period_end,
          current_period_start,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        },
      },
      { merge: true },
    );
  });
}

// Resolve UID by customerId using mapping collection and users query
async function resolveUidFromCustomer(customerId?: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const mapSnap = await db.doc(`stripeCustomers/${customerId}`).get();
    const mapped = mapSnap.exists ? (mapSnap.data() as any)?.uid : null;
    if (mapped) return mapped as string;
  } catch {}
  const q = await db.collection('users').where('subscription.customerId', '==', customerId).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}

async function writeOrphan(kind: string, id: string, payload: any) {
  try {
    await db.doc(`stripeOrphans/${kind}_${id}`).set(
      { createdAt: admin.firestore.FieldValue.serverTimestamp(), payload },
      { merge: true },
    );
  } catch (e) {
    console.warn('Failed to write orphan record', kind, id, e);
  }
}

// New: unified writer with period override + cadence, with source labeling
async function writeSubState(
  uid: string,
  sub: Stripe.Subscription,
  txnId: string,
  sourceLabel: string,
  sessionId?: string | null,
  periodOverride?: { startTs: admin.firestore.Timestamp | null; endTs: admin.firestore.Timestamp | null },
) {
  const userRef = db.collection('users').doc(uid);
  const txRef = userRef.collection('transactions').doc(txnId);

  const item = sub.items.data?.[0];
  const price = item?.price;
  const start = periodOverride?.startTs ?? tsFromSec(item?.current_period_start ?? null);
  const end   = periodOverride?.endTs   ?? tsFromSec(item?.current_period_end   ?? null);

  const payload = {
    type: 'subscription' as const,
    source: sourceLabel,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutSessionId: sessionId ?? null,
    customerId: sub.customer,
    subscriptionId: sub.id,
    status: sub.status,
    priceId: price?.id ?? null,
    priceCadence: {
      interval: price?.recurring?.interval ?? null,
      interval_count: price?.recurring?.interval_count ?? null,
    },
    quantity: sub.items.data?.[0]?.quantity ?? 1,
    current_period_start: start,
    current_period_end:   end,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    latest_invoice: typeof sub.latest_invoice === 'string' ? sub.latest_invoice : (sub.latest_invoice as any)?.id ?? null,
  };

  const isActive = ['active','trialing','past_due'].includes(sub.status);

  console.log(`📝 Writing subscription state for uid=${uid} txn=${txnId} start=${start?.toDate?.()?.toISOString?.()}`);
  await db.runTransaction(async (t) => {
    t.set(txRef, payload, { merge: true });
    t.set(
      userRef,
      {
        isSubscribed: isActive,
        subscription: {
          id: sub.id,
          status: sub.status,
          customerId: sub.customer,
          priceId: price?.id ?? null,
          priceCadence: payload.priceCadence,
          current_period_start: start,
          current_period_end:   end,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
        },
      },
      { merge: true },
    );
  });
  console.log(`✅ Wrote subscription for uid=${uid} txn=${txnId}`);
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
        current_period_start: sub.items.data?.[0]?.current_period_start
          ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
          : null,
        current_period_end: sub.items.data?.[0]?.current_period_end
          ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
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
    // Use the rawBody provided by Firebase Functions to verify signature
    const raw = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[stripe] signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log('➡️ Event received:', event.type);
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
          const uid = await resolveUidFromSession(session);
          if (!uid) break;
          const subId = session.subscription as string;
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
          await writeSubscriptionTransaction(uid, session, sub);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.parent?.subscription_details?.subscription;
        if (subId && invoice.customer) {
          try {
            const sub = await stripe.subscriptions.retrieve(String(subId), { expand: ['items.data.price'] });
            const snap = await db
              .collection('users')
              .where('subscription.customerId', '==', String(invoice.customer))
              .limit(1)
              .get();
            const uid = snap.empty ? null : snap.docs[0].id;
            if (uid) {
              const sessionShell = { id: `inv:${invoice.id ?? 'unknown'}` } as unknown as Stripe.Checkout.Session;
              await writeSubscriptionTransaction(uid, sessionShell, sub);
            }
          } catch (e) {
            console.error('invoice.paid handling failed', e);
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
        const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;
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

      // Keep subscription lifecycle in sync (upgrade, cancel, renew)
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const uid = await resolveUidFromCustomer(customerId);
        if (!uid) {
          console.warn('⚠️ lifecycle: no uid for customer', customerId);
          await writeOrphan('lifecycle_no_uid', sub.id, sub);
          break;
        }
        const item = sub.items.data?.[0];
        const price = item?.price ?? null;
        let startTs = tsFromSec(item?.current_period_start ?? null);
        let endTs   = tsFromSec(item?.current_period_end   ?? null);
        if (!startTs || !endTs) {
          const derived = derivePeriodFromPrice({
            startSec: item?.current_period_start ?? event.created,
            price,
            eventCreatedSec: event.created,
          });
          startTs = startTs ?? derived.startTs;
          endTs   = endTs   ?? derived.endTs;
        }
        await writeSubState(uid, sub, `evt:${event.id}`, event.type, null, { startTs, endTs });
        break;
      }

      // Renewal/paid invoices path
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.parent?.subscription_details?.subscription;
        if (subId && inv.customer) {
          try {
            const invoice = (inv as any)?.lines?.data?.length
              ? inv
              : await stripe.invoices.retrieve(inv.id!, { expand: ['lines.data.price'] });
            const line = (invoice as any)?.lines?.data?.[0];
            let startTs = line?.period?.start ? tsFromSec(line.period.start) : null;
            let endTs   = line?.period?.end   ? tsFromSec(line.period.end)   : null;

            const sub = await stripe.subscriptions.retrieve(String(subId), { expand: ['items.data.price'] });
            const item = sub.items.data?.[0];
            const price = item?.price ?? null;

            if (!startTs || !endTs) {
              const derived = derivePeriodFromPrice({
                startSec: item?.current_period_start ?? inv.created,
                price,
                eventCreatedSec: inv.created,
              });
              startTs = startTs ?? derived.startTs;
              endTs   = endTs   ?? derived.endTs;
            }

            const uid = await resolveUidFromCustomer(String(inv.customer));
            if (!uid) {
              console.warn('⚠️ invoice.paid: no uid for customer', inv.customer);
              await writeOrphan('invoice_no_uid', inv.id ?? 'unknown', inv);
              break;
            }
            await writeSubState(uid, sub, `inv:${inv.id ?? 'unknown'}`, 'invoice.paid', null, { startTs, endTs });
          } catch (e) {
            console.error('invoice.paid handling failed', e);
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        // New flow: tokens purchased via PaymentSheet callable
        if ((pi.metadata?.type || '') === 'token_purchase') {
          const uid = (pi.metadata as any)?.userId as string | undefined;
          const tokenAmount = parseInt((pi.metadata as any)?.tokenAmount || '0', 10) || 0;
          if (uid && tokenAmount > 0) {
            await firestore.doc(`users/${uid}`).set({
              tokens: admin.firestore.FieldValue.increment(tokenAmount),
            }, { merge: true });
            // Log transaction under users/{uid}/transactions
            await firestore.doc(`users/${uid}/transactions/${pi.id}`).set({
              type: 'tokens',
              tokens: tokenAmount,
              amount: pi.amount_received ?? pi.amount ?? null,
              currency: pi.currency ?? null,
              paymentIntentId: pi.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`[stripe] token_purchase: awarded ${tokenAmount} tokens to ${uid}`);
          }
        }
        // New flow: tokens purchased via PaymentIntent metadata
        if ((pi.metadata?.type || '') === 'tokens') {
          const uid = pi.metadata?.uid as string | undefined;
          const tokens = parseInt(pi.metadata?.tokensPurchased || '0', 10) || 0;
          if (uid && tokens > 0) {
            await firestore.doc(`users/${uid}`).set({
              tokens: admin.firestore.FieldValue.increment(tokens),
            }, { merge: true });
            // Log transaction under users/{uid}/transactions
            await firestore.doc(`users/${uid}/transactions/${pi.id}`).set({
              type: 'tokens',
              tokens,
              amount: pi.amount_received ?? pi.amount ?? null,
              currency: pi.currency ?? null,
              paymentIntentId: pi.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`Awarded ${tokens} tokens to ${uid}`);
          }
        }
        // Donations via PaymentIntent metadata
        if ((pi.metadata?.purpose || pi.metadata?.type) === 'donation') {
          const uid = pi.metadata?.uid as string | undefined;
          if (uid) {
            await firestore.doc(`users/${uid}/transactions/${pi.id}`).set({
              type: 'donation',
              amount: pi.amount_received ?? pi.amount ?? null,
              currency: pi.currency ?? null,
              paymentIntentId: pi.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`[stripe] logged donation for ${uid}: ${pi.id}`);
          }
        }
        // Backward-compat: previous tokenAmount metadata
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
