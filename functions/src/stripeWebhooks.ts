import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import Stripe from 'stripe';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const db = firestore;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as Stripe.StripeConfig['apiVersion'],
});
type S = Stripe;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function normalize<T>(obj: T | Stripe.Response<T>): T {
  return (obj as any)?.data ?? (obj as T);
}

function subIdFromInvoice(inv: Stripe.Invoice): string | null {
  const raw = (inv as any).subscription;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : (raw.id as string | undefined) ?? null;
}

function tsFromSec(sec: number | null | undefined) {
  return sec ? new Date(sec * 1000).toISOString() : null;
}

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

// Firestore Timestamp helper from seconds
function timestampFromSec(sec?: number | null) {
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
  if (!rec) return { startTs: timestampFromSec(start), endTs: null as admin.firestore.Timestamp | null };
  const endMs = addInterval(start * 1000, rec.interval as any, rec.interval_count ?? 1);
  return { startTs: timestampFromSec(start), endTs: admin.firestore.Timestamp.fromMillis(endMs) };
}

async function writeSubscriptionTransaction(
  uid: string,
  session: Stripe.Checkout.Session,
  sub: Stripe.Subscription | Stripe.Response<Stripe.Subscription>,
) {
  const ref = db.collection('users').doc(uid);
  const txRef = ref.collection('transactions').doc(session.id);
  const subObj = normalize<Stripe.Subscription>(sub as any) as any;
  const endSec = subObj.current_period_end ?? null;
  const startSec = subObj.current_period_start ?? null;
  const current_period_end = endSec ? admin.firestore.Timestamp.fromMillis(endSec * 1000) : null;
  const current_period_start = startSec ? admin.firestore.Timestamp.fromMillis(startSec * 1000) : null;

  const price = subObj.items?.data?.[0]?.price;

  const txPayload = {
    type: 'subscription' as const,
    mode: 'subscription' as const,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutSessionId: session.id,
    customerId: subObj.customer,
    subscriptionId: subObj.id,
    status: subObj.status,
    priceId: price?.id ?? null,
    quantity: subObj.items?.data?.[0]?.quantity ?? 1,
    current_period_end,
    current_period_start,
    cancel_at_period_end: subObj.cancel_at_period_end ?? false,
    latest_invoice: subObj.latest_invoice ?? null,
  };

  await db.runTransaction(async (t) => {
    t.set(txRef, txPayload, { merge: true });
    t.set(
      ref,
      {
        isSubscribed:
          subObj.status === 'active' || subObj.status === 'trialing' || subObj.status === 'past_due',
        subscription: {
          id: subObj.id,
          status: subObj.status,
          customerId: subObj.customer,
          priceId: price?.id ?? null,
          current_period_end,
          current_period_start,
          cancel_at_period_end: subObj.cancel_at_period_end ?? false,
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

  const subObj = normalize<Stripe.Subscription>(sub as any) as any;
  const price = subObj.items.data?.[0]?.price;
  const start = periodOverride?.startTs ?? timestampFromSec(subObj.current_period_start ?? null);
  const end   = periodOverride?.endTs   ?? timestampFromSec(subObj.current_period_end   ?? null);

  const payload = {
    type: 'subscription' as const,
    source: sourceLabel,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutSessionId: sessionId ?? null,
    customerId: subObj.customer,
    subscriptionId: subObj.id,
    status: subObj.status,
    priceId: price?.id ?? null,
    priceCadence: {
      interval: price?.recurring?.interval ?? null,
      interval_count: price?.recurring?.interval_count ?? null,
    },
    quantity: subObj.items.data?.[0]?.quantity ?? 1,
    current_period_start: start,
    current_period_end:   end,
    cancel_at_period_end: subObj.cancel_at_period_end ?? false,
    latest_invoice: typeof subObj.latest_invoice === 'string' ? subObj.latest_invoice : (subObj.latest_invoice as any)?.id ?? null,
  };
  const isActive = ['active','trialing','past_due'].includes(subObj.status);

  console.log(`📝 Writing subscription state for uid=${uid} txn=${txnId} start=${start?.toDate?.()?.toISOString?.()}`);
  await db.runTransaction(async (t) => {
    t.set(txRef, payload, { merge: true });
    t.set(
      userRef,
      {
        isSubscribed: isActive,
        subscription: {
          id: subObj.id,
          status: subObj.status,
          customerId: subObj.customer,
          priceId: price?.id ?? null,
          priceCadence: payload.priceCadence,
          current_period_start: start,
          current_period_end:   end,
          cancel_at_period_end: subObj.cancel_at_period_end ?? false,
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
  const subRaw =
    'items' in input
      ? (input as Stripe.Subscription)
      : await stripe.subscriptions.retrieve(input.id as string);
  const sub = normalize<Stripe.Subscription>(subRaw as any) as any;
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
          current_period_start: tsFromSec(sub.current_period_start ?? null),
          current_period_end: tsFromSec(sub.current_period_end ?? null),
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
          const subscriptionId = subIdFromInvoice(invoice);
          if (subscriptionId && invoice.customer) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] });
              const subObj = normalize<Stripe.Subscription>(sub as any) as any;
              const snap = await db
                .collection('users')
                .where('subscription.customerId', '==', String(invoice.customer))
                .limit(1)
                .get();
              const uid = snap.empty ? null : snap.docs[0].id;
              if (uid) {
                const sessionShell = { id: `inv:${invoice.id}` } as unknown as Stripe.Checkout.Session;
                await writeSubscriptionTransaction(uid, sessionShell, subObj);
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
        const subscriptionId = subIdFromInvoice(invoice);
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
          const subObj = normalize<Stripe.Subscription>(sub as any) as any;
          await upsertSubscriptionFromStripe(subObj);
          const uid = subObj.metadata?.uid || (await lookupUidByCustomerId(subObj.customer as string));
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
        const subObj = normalize<Stripe.Subscription>(sub as any) as any;
        const customerId = String(subObj.customer);
        const uid = await resolveUidFromCustomer(customerId);
        if (!uid) {
          console.warn('⚠️ lifecycle: no uid for customer', customerId);
          await writeOrphan('lifecycle_no_uid', subObj.id, subObj);
          break;
        }
        const price = subObj.items.data?.[0]?.price ?? null;
        let startTs = timestampFromSec(subObj.current_period_start ?? null);
        let endTs   = timestampFromSec(subObj.current_period_end   ?? null);
        if (!startTs || !endTs) {
          const derived = derivePeriodFromPrice({
            startSec: subObj.current_period_start ?? event.created,
            price,
            eventCreatedSec: event.created,
          });
          startTs = startTs ?? derived.startTs;
          endTs   = endTs   ?? derived.endTs;
        }
        await writeSubState(uid, subObj, `evt:${event.id}`, event.type, null, { startTs, endTs });
        break;
      }

      // Renewal/paid invoices path
        case 'invoice.paid': {
          const inv = event.data.object as Stripe.Invoice;
          const subscriptionId = subIdFromInvoice(inv);
          if (subscriptionId && inv.customer) {
            try {
              const invRefetched = (inv as any)?.lines?.data?.length
                ? inv
                : await stripe.invoices.retrieve(inv.id as string, { expand: ['lines.data.price'] });
              const invObj = normalize<Stripe.Invoice>(invRefetched) as any;
              const line = invObj.lines?.data?.[0];
              let startTs = line?.period?.start ? timestampFromSec(line.period.start) : null;
              let endTs   = line?.period?.end   ? timestampFromSec(line.period.end)   : null;

              const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] });
              const subObj = normalize<Stripe.Subscription>(sub as any) as any;
              const price = subObj.items.data?.[0]?.price ?? null;

              if (!startTs || !endTs) {
                const derived = derivePeriodFromPrice({
                  startSec: subObj.current_period_start ?? invObj.created,
                  price,
                  eventCreatedSec: invObj.created,
                });
                startTs = startTs ?? derived.startTs;
                endTs   = endTs   ?? derived.endTs;
              }

              const uid = await resolveUidFromCustomer(String(invObj.customer));
              if (!uid) {
                console.warn('⚠️ invoice.paid: no uid for customer', invObj.customer);
                  await writeOrphan('invoice_no_uid', invObj.id as string, invObj);
                break;
              }
              await writeSubState(uid, subObj, `inv:${invObj.id}`, 'invoice.paid', null, { startTs, endTs });
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
