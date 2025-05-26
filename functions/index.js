require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const stripeLib = require("stripe");

// 🔐 Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!GEMINI_API_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error("❌ Missing required environment variables.");
}

// 🌍 Region Setup
setGlobalOptions({ region: "us-central1" });

// 🔥 Firebase Initialization
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// 🌟 askGeminiV2 — Secure Gemini Chat API via Firebase
exports.askGeminiV2 = onRequest(async (req, res) => {
  const { prompt, history = [] } = req.body;
  const idToken = req.headers.authorization?.split("Bearer ")[1];

  if (!idToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await admin.auth().verifyIdToken(idToken);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const chat = await model.startChat({
      history: history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    res.status(200).json({ response: text });
  } catch (err) {
    console.error("❌ askGeminiV2 error:", err);
    res.status(500).json({ error: "Gemini chat failed." });
  }
});

// 💳 Stripe Webhook: Activate Subscriptions on Payment Success
exports.handleStripeWebhookV2 = onRequest({ rawRequest: true }, async (req, res) => {
  const stripe = stripeLib(STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  if (event.type === "checkout.session.completed") {
    const userId = data.metadata?.userId;
    if (userId) {
      await db.collection("subscriptions").doc(userId).set({ active: true });
      console.log(`✅ Subscription activated for user ${userId}`);
    }
  }

  res.status(200).send("Success");
});
