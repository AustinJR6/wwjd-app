require("dotenv").config(); // 🌱 Load .env variables

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const stripeLib = require("stripe");

// 🔐 Secure environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// 🧠 Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 🌍 Set default region for all functions
setGlobalOptions({ region: "us-central1" });

// 🔥 Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// ✨ askGeminiV2 — Ask Jesus powered by Gemini 2.0
exports.askGeminiV2 = onRequest(async (req, res) => {
    const { prompt } = req.body;
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    try {
        await admin.auth().verifyIdToken(idToken);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("🔥 Gemini response:", text);

        res.status(200).json({ response: text });
    } catch (err) {
        console.error("❌ Gemini SDK error:", err);
        res.status(500).json({ error: "Gemini request failed", details: err.message });
    }
});

// 💳 handleStripeWebhookV2 — Secure Stripe subscription handling
exports.handleStripeWebhookV2 = onRequest({ rawRequest: true }, async (req, res) => {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        console.error("❌ Stripe secrets missing.");
        return res.status(500).send("Stripe configuration missing.");
    }

    const stripe = stripeLib(STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];
    const endpointSecret = STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error("❌ Stripe webhook verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const data = event.data.object;

    if (event.type === "checkout.session.completed") {
        const userId = data.metadata?.userId;
        if (userId) {
            try {
                await db.collection("subscriptions").doc(userId).set({ active: true }, { merge: true });
                console.log(`✅ Subscription updated for user ${userId}`);
            } catch (err) {
                console.error("❌ Firestore write error:", err);
            }
        }
    }

    res.status(200).send("Success");
});
