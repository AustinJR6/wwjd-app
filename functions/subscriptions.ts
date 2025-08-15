import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { STRIPE_SECRET_KEY } from './params';
import { getStripe } from './stripeClient';
import { getOrCreateStripeCustomer } from './stripeHelpers';

if (!admin.apps.length) admin.initializeApp();

// Helper: extract uid from Authorization: Bearer <ID_TOKEN> or header x-uid (dev)
async function requireUid(req: any): Promise<string> {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/i);
  if (m) {
    try {
      const decoded = await admin.auth().verifyIdToken(m[1]);
      return decoded.uid;
    } catch (e) {}
  }
  const uidHeader = req.headers['x-uid'];
  if (typeof uidHeader === 'string' && uidHeader) return uidHeader;
  throw new Error('Unauthorized: missing valid Firebase ID token or x-uid header');
}

// Tell Stripe which mobile SDK version to use for ephemeral key
const MOBILE_API_VERSION = '2023-10-16'; // match RN-Stripe SDK

export const prepareSubscriptionPaymentSheet = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (req, res) => {
      try {
        if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
        const uid = await requireUid(req);

      const userRecord = await admin.auth().getUser(uid).catch(() => null);
      const email = userRecord?.email || undefined;
      const stripe = getStripe();
      const customerId = await getOrCreateStripeCustomer(uid, email);

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: MOBILE_API_VERSION as any }
      );

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { uid },
      });

      const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

        if (!ephemeralKey?.secret || !setupIntent?.client_secret) {
          console.error('prepareSubscriptionPaymentSheet: missing ephemeral or setup intent secret', {
            uid, customerId,
          });
          res.status(500).json({ error: 'Missing secrets for PaymentSheet' });
          return;
        }

      console.info('prepareSubscriptionPaymentSheet', { uid, customerId });

      res.json({
        customer: customerId,
        ephemeralKey: ephemeralKey.secret,
        setupIntent: setupIntent.client_secret,
        publishableKey,
      });
      return;
    } catch (err: any) {
      console.error('prepareSubscriptionPaymentSheet.error', err?.message || err);
      res.status(500).json({ error: String(err?.message || err) });
      return;
    }
  }
);

export const activateSubscription = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (req, res) => {
    try {
        if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
      const uid = await requireUid(req);
        const { priceId, trial_days } = req.body || {};
        if (!priceId) { res.status(400).json({ error: 'priceId required' }); return; }

      const stripe = getStripe();
      const customerId = await getOrCreateStripeCustomer(uid);

      const sub: any = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_settings: { save_default_payment_method: 'on_subscription' },
        trial_settings: trial_days ? { end_behavior: { missing_payment_method: 'cancel' } } : undefined,
        trial_period_days: trial_days ? Number(trial_days) : undefined,
        metadata: { uid },
        expand: ['latest_invoice.payment_intent'],
      });

      const status = sub.status;
      const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

      await admin.firestore().doc(`subscriptions/${uid}`).set({
        subscriptionId: sub.id,
        status,
        currentPeriodEnd,
        productId: sub.items.data[0]?.price?.product || null,
        priceId: sub.items.data[0]?.price?.id || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: ['active', 'trialing'].includes(status),
      }, { merge: true });

      await admin.firestore().doc(`users/${uid}`).set({
        isSubscribed: ['active', 'trialing'].includes(status),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.info('activateSubscription', { uid, subId: sub.id, status });
      res.json({ ok: true, status, currentPeriodEnd });
      return;
    } catch (err: any) {
      console.error('activateSubscription.error', err?.message || err);
      res.status(500).json({ error: String(err?.message || err) });
      return;
    }
  }
);
