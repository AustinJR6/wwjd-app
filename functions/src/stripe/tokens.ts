import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" as any });

export const createTokenPaymentIntent = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") { res.set("Allow", "POST"); return res.status(405).send("Method Not Allowed"); }
  try {
    const { userId, tokenAmount, amountUsd, customerId } = req.body || {};
    if (!userId || !tokenAmount || !amountUsd) return res.status(400).send("Missing params");

    const amount = Math.round(Number(amountUsd) * 100);
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "token_pack",
        userId: String(userId),
        tokenAmount: String(tokenAmount),
        amountUsd: String(amountUsd),
      },
    });

    return res.status(200).send({ clientSecret: pi.client_secret });
  } catch (err: any) {
    console.error("[createTokenPaymentIntent] error", err);
    return res.status(500).send(err?.message || "Server error");
  }
});

