import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" as any });

export const createSubscriptionSetup = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") { 
    res.set("Allow", "POST"); 
    res.status(405).send("Method Not Allowed"); 
    return;
  }
  try {
    const { customerId } = req.body || {};
    if (!customerId) {
      res.status(400).send("Missing customerId");
      return;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { purpose: "collect_pm_for_subscription" },
    });

    const ephKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: "2025-03-31.basil" as any });

    res.status(200).send({
      setupClientSecret: setupIntent.client_secret,
      ephemeralKeySecret: ephKey.secret,
    });
  } catch (err: any) {
    console.error("[createSubscriptionSetup] error", err);
    res.status(500).send(err?.message || "Server error");
  }
});

export const activateSubscription = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") { 
    res.set("Allow", "POST"); 
    res.status(405).send("Method Not Allowed"); 
    return; 
  }
  try {
    const { customerId, setupClientSecret, priceId, userId } = req.body || {};
    if (!customerId || !setupClientSecret || !priceId || !userId) {
      res.status(400).send("Missing params");
      return;
    }

    const siId = String(setupClientSecret).split("_secret_")[0];
    const si = await stripe.setupIntents.retrieve(siId);

    const paymentMethodId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
    if (!paymentMethodId) {
      res.status(400).send("No payment method on SetupIntent");
      return;
    }

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: { userId },
    });

    const latestInvoice: any = sub.latest_invoice;
    const pi = latestInvoice?.payment_intent as Stripe.PaymentIntent | undefined;

    if (pi && (pi.status === "requires_action" || pi.status === "requires_confirmation")) {
      res.status(200).send({
        status: "requires_confirmation",
        paymentIntentClientSecret: pi.client_secret,
        subscriptionId: sub.id,
      });
      return;
    }

    res.status(200).send({ status: "active_or_processing", subscriptionId: sub.id });
  } catch (err: any) {
    console.error("[activateSubscription] error", err);
    res.status(500).send(err?.message || "Server error");
  }
});

