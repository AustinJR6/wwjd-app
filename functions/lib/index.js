"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhookV2 = exports.askGeminiV2 = void 0;
require("dotenv/config");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const generative_ai_1 = require("@google/generative-ai");
const stripe_1 = __importDefault(require("stripe"));
const firebase_1 = require("./firebase"); // ✅ use centralized firebase.ts (admin)
// 🔐 Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// 🚨 Validate .env setup
if (!GEMINI_API_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    throw new Error("❌ Missing required environment variables.");
}
// 📍 Set default Firebase region
(0, v2_1.setGlobalOptions)({ region: "us-central1" });
/**
 * 🌟 askGeminiV2: Secure Gemini Chat endpoint
 */
exports.askGeminiV2 = (0, https_1.onRequest)(async (req, res) => {
    const { prompt, history = [] } = req.body;
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
        res.status(401).json({ error: "Unauthorized" });
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
        const text = result.response.text();
        res.status(200).json({ response: text });
    }
    catch (err) {
        console.error("❌ askGeminiV2 error:", err.message);
        res.status(500).json({ error: "Gemini chat failed." });
    }
});
/**
 * 💳 handleStripeWebhookV2: Activates subscriptions post-checkout
 */
exports.handleStripeWebhookV2 = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    const stripe = new stripe_1.default(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        res.status(400).send("Missing Stripe signature.");
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
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
            await firebase_1.db.collection("subscriptions").doc(userId).set({ active: true });
            console.log(`✅ Subscription activated for user ${userId}`);
        }
    }
    res.status(200).send("Success");
});
