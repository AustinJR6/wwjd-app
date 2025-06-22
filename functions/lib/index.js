"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementReligionPoints = exports.handleStripeWebhookV2 = exports.askGeminiV2 = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env.functions" });
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const generative_ai_1 = require("@google/generative-ai");
const stripe_1 = __importDefault(require("stripe"));
const firebase_1 = require("./firebase"); // Firebase Admin SDK
// 🔐 Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// 🚨 Validate .env setup
if (!GEMINI_API_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    throw new Error("❌ Missing required environment variables in .env file");
}
// 🌎 Default Firebase region
(0, v2_1.setGlobalOptions)({ region: "us-central1" });
/**
 * 🌟 askGeminiV2: Secure endpoint to generate AI chat via Gemini
 */
exports.askGeminiV2 = (0, https_1.onRequest)(async (req, res) => {
    const { prompt, history = [] } = req.body;
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
        res.status(401).json({ error: "Unauthorized – No ID token provided" });
        return;
    }
    try {
        await firebase_1.auth.verifyIdToken(idToken);
        const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const chat = await model.startChat({
            history: history.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.text }],
            })),
        });
        const result = await chat.sendMessage(prompt);
        const text = result?.response?.text?.() ?? "No response text returned.";
        res.status(200).json({ response: text });
    }
    catch (err) {
        console.error("❌ askGeminiV2 error:", err.message);
        res.status(500).json({ error: "Gemini chat failed." });
    }
});
/**
 * 💳 handleStripeWebhookV2: Activates subscriptions after checkout
 */
exports.handleStripeWebhookV2 = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    const stripe = new stripe_1.default(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
        res.status(400).send("Missing Stripe signature.");
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
        console.log(`📦 Stripe event received: ${event.type}`);
    }
    catch (err) {
        console.error("❌ Stripe Webhook Error:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    const data = event.data.object;
    if (event.type === "checkout.session.completed") {
        const userId = data.metadata?.userId;
        if (userId) {
            try {
                await firebase_1.db.collection("subscriptions").doc(userId).set({ active: true });
                console.log(`✅ Subscription activated for user ${userId}`);
            }
            catch (err) {
                console.error(`❌ Firestore update failed for user ${userId}:`, err);
                res.status(500).send("Failed to update subscription.");
                return;
            }
        }
    }
    res.status(200).send("Success");
});

/**
 * 💳 createCheckoutSession: Starts a Stripe Checkout session
 */
exports.createCheckoutSession = (0, https_1.onRequest)(async (req, res) => {
    const stripe = new stripe_1.default(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
    const { uid, type, amount } = req.body;
    if (!uid || !type) {
        res.status(400).json({ error: "Missing parameters." });
        return;
    }
    try {
        let session;
        if (type === "subscription") {
            session = await stripe.checkout.sessions.create({
                mode: "subscription",
                line_items: [
                    {
                        price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
                        quantity: 1,
                    },
                ],
                metadata: { userId: uid },
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
            });
        }
        else {
            session = await stripe.checkout.sessions.create({
                mode: "payment",
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: { name: "Token Pack" },
                            unit_amount: Math.round((amount || 0) * 100),
                        },
                        quantity: 1,
                    },
                ],
                metadata: { userId: uid },
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
            });
        }
        res.status(200).json({ url: session.url });
    }
    catch (err) {
        console.error("❌ createCheckoutSession error:", err.message);
        res.status(500).json({ error: "Failed to create checkout session." });
    }
});

/**
 * 🔐 incrementReligionPoints: Safely update religion totals
 */
exports.incrementReligionPoints = (0, https_1.onRequest)(async (req, res) => {
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
        res.status(401).send("Unauthorized – no token");
        return;
    }
    try {
        await firebase_1.auth.verifyIdToken(idToken);
        const { religion, points } = req.body;
        if (typeof religion !== "string" || typeof points !== "number" || points <= 0 || points > 100) {
            res.status(400).send("Invalid input.");
            return;
        }
        const ref = firebase_1.db.collection("religions").doc(religion);
        await firebase_1.db.runTransaction(async (t) => {
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data().totalPoints || 0) : 0;
            t.set(ref, { totalPoints: current + points }, { merge: true });
        });
        res.status(200).send({ message: "Points updated" });
    }
    catch (err) {
        console.error("🔥 Religion update failed:", err.message);
        res.status(500).send("Internal error");
    }
});
