import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

export const createTokenPaymentIntent = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    const { userId, tokenAmount, amountUsd, customerId } = req.body || {};
    if (!userId || !tokenAmount || !amountUsd) {
      res.status(400).send("Missing params");
      return;
    }

    const amount = Math.round(Number(amountUsd) * 100);
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "tokens",
        uid: String(userId),
        quantity: String(tokenAmount),
        amountUsd: String(amountUsd),
      },
    });

    res.status(200).send({ clientSecret: pi.client_secret });
  } catch (err: any) {
    console.error("[createTokenPaymentIntent] error", err);
    res.status(500).send(err?.message || "Server error");
  }
});

