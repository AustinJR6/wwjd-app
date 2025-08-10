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
        const uid = sub.metadata?.uid;
        const minimal = { eventType: event.type, subscriptionId: sub.id };
        if (!uid) {
          console.warn('Missing uid in subscription', minimal);
          res.sendStatus(200);
          return;
        }
        const status = sub.status;
        const doc = {
          status,
          subscriptionId: sub.id,
          currentPeriodStart: tsFromUnix((sub as any).current_period_start),
          currentPeriodEnd: tsFromUnix((sub as any).current_period_end),
          invoiceId:
            typeof sub.latest_invoice === 'string'
              ? sub.latest_invoice
              : sub.latest_invoice?.id || null,
          tier: sub.metadata?.tier || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await firestore.doc(`subscriptions/${uid}`).set(doc, { merge: true });
        const isActive = status === 'active' || status === 'trialing';
        await firestore
          .doc(`users/${uid}`)
          .set({ isSubscribed: isActive }, { merge: true });
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
    default:
      console.log(`Unhandled event type: ${event.type}`);
      res.sendStatus(200);
      return;
  }
});

