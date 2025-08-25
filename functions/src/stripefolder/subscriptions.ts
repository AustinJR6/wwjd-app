import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

const PROFILES_COLLECTION = process.env.PROFILES_COLLECTION || "profiles"; // changeable
const PRICE_ID = process.env.STRIPE_PRICE_ID!; // e.g. price_1234 (test price for dev)

export const createSubscriptionPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }
  const uid = context.auth.uid;

  const profileRef = admin.firestore().collection(PROFILES_COLLECTION).doc(uid);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.data() || {};

  const email: string | undefined = profile.email;
  if (!email) {
    throw new functions.https.HttpsError("failed-precondition", "Profile missing email");
  }

  let customerId: string | undefined = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { uid } });
    customerId = customer.id;
    await profileRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  // Create subscription in "incomplete" state and expand first invoice PI
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: PRICE_ID }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
    metadata: { uid },
  });

  const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
  const pi = (latestInvoice as any)?.payment_intent as Stripe.PaymentIntent | null;

  if (!pi?.client_secret) {
    throw new functions.https.HttpsError("internal", "No PaymentIntent on first invoice");
  }

  return {
    subscriptionId: sub.id,
    clientSecret: pi.client_secret,
    customerId,
  };
});

