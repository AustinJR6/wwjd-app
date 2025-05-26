import "dotenv/config";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import { auth, db } from "./firebase"; // Firebase Admin SDK

// 🔐 Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// 🚨 Validate .env setup
if (!GEMINI_API_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error("❌ Missing required environment variables in .env file");
}

// 🌎 Default Firebase region
setGlobalOptions({ region: "us-central1" });

/**
 * 🌟 askGeminiV2: Secure endpoint to generate AI chat via Gemini
 */
export const askGeminiV2 = onRequest(async (req, res) => {
  const { prompt, history = [] } = req.body;
  const idToken = req.headers.authorization?.split("Bearer ")[1];

  if (!idToken) {
    res.status(401).json({ error: "Unauthorized – No ID token provided" });
    return;
  }

  try {
    await auth.verifyIdToken(idToken);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const chat = await model.startChat({
      history: (history as any[]).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const text = result?.response?.text?.() ?? "No response text returned.";

    res.status(200).json({ response: text });
  } catch (err: unknown) {
    console.error("❌ askGeminiV2 error:", (err as Error).message);
    res.status(500).json({ error: "Gemini chat failed." });
  }
});

/**
 * 💳 handleStripeWebhookV2: Activates subscriptions after checkout
 */
export const handleStripeWebhookV2 = onRequest({ cors: true }, async (req, res) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).send("Missing Stripe signature.");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
    console.log(`📦 Stripe event received: ${event.type}`);
  } catch (err: unknown) {
    console.error("❌ Stripe Webhook Error:", (err as Error).message);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  const data = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    const userId = data.metadata?.userId;

    if (userId) {
      try {
        await db.collection("subscriptions").doc(userId).set({ active: true });
        console.log(`✅ Subscription activated for user ${userId}`);
      } catch (err) {
        console.error(`❌ Firestore update failed for user ${userId}:`, err);
        res.status(500).send("Failed to update subscription.");
        return;
      }
    }
  }

  res.status(200).send("Success");
});
