import { onRequest } from "firebase-functions/v2/https";
import { auth, db } from "./firebase";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const LOGGING_MODE = process.env.LOGGING_MODE || "gusbug";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || "https://example.com/success";
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";
const stripe = new Stripe(
  STRIPE_SECRET_KEY,
  {
    apiVersion: "2022-11-15",
  } as any,
);

export const incrementReligionPoints = onRequest(async (req, res) => {
  console.log("🔍 Headers received:", req.headers);

  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: No ID token provided.");
    res.status(401).send("Unauthorized: Missing ID token.");
    return;
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(idToken);
    console.log(`✅ Gus Bug Authenticated: ${decoded.uid}`);
    const { religion, points } = req.body;

    if (
      typeof religion !== "string" ||
      typeof points !== "number" ||
      points <= 0 ||
      points > 100
    ) {
      res.status(400).send("Invalid input.");
      return;
    }

    const ref = db.collection("religions").doc(religion);
    await db.runTransaction(async (t: FirebaseFirestore.Transaction) => {
      const snap = await t.get(ref);
      const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
      t.set(ref, { totalPoints: current + points }, { merge: true });
    });

    res.status(200).send({ message: "Points updated" });
  } catch (err: any) {
    console.error("🛑 Gus Bug Tampered Token: Couldn't verify. 🧙‍♂️✨", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).send("Internal error");
  }
});

export const completeChallenge = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log(`✅ Gus Bug Authenticated: ${decodedToken.uid} is legit! 🎯`);
    res.status(200).send({ message: "✅ completeChallenge function is live" });
  } catch (err) {
    console.error("🛑 Gus Bug Tampered Token: Couldn't verify. 🧙‍♂️✨", err);
    res.status(401).json({
      error: "Unauthorized — Gus bug cast an invalid token spell.",
    });
    return;
  }
});

export const askGeminiSimple = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", history = [] } = req.body || {};

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    console.log(`✅ Gus Bug Authenticated: ${uid} is legit! 🎯`);

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
  } catch (err: any) {
    console.error("🛑 Gus Bug Tampered Token: Couldn't verify. 🧙‍♂️✨", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: "Gemini failed" });
  }
});

export const askGeminiV2 = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", history = [] } = req.body || {};

  try {
    const decoded = await auth.verifyIdToken(idToken);
    console.log(`✅ GeminiV2 user: ${decoded.uid}`);

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
  } catch (err: any) {
    console.error("🛑 Gus Bug Tampered Token: Couldn't verify or Gemini failed", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }

    if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              ...((history as any[]).map((msg) => ({ role: msg.role, content: msg.text }))),
              { role: 'user', content: prompt },
            ],
          }),
        });
        const data: any = await response.json();
        const text = data?.choices?.[0]?.message?.content || 'No OpenAI response';
        res.status(200).json({ response: text });
        return;
      } catch (openErr) {
        console.error('OpenAI fallback failed', openErr);
      }
    }

    res.status(500).json({ error: "Gemini failed" });
  }
});

export const generateChallenge = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", history = [], seed = Date.now() } = req.body || {};

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    console.log(`✅ Gus Bug Authenticated: ${uid} is legit! 🎯`);

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const userData = snap.exists ? snap.data() : {};
    const recent: string[] = Array.isArray(userData?.recentChallenges)
      ? userData!.recentChallenges
      : [];

    const avoid = recent
      .map((c, i) => `#${i + 1}: ${c}`)
      .join("\n");

    const randomizer = `Seed:${seed}`;

    const basePrompt = prompt.trim() ||
      "Generate a new, unique, and creative spiritual challenge inspired by Christian teachings.";
    const fullPrompt = `${basePrompt}\n\nDo NOT repeat or closely resemble any of the following recent challenges:\n${avoid}\n\nRespond ONLY with the new challenge text.`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const chat = await model.startChat({
      history: (history as any[]).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(`${fullPrompt}\n${randomizer}`);
    const text = result?.response?.text?.() ?? "No response text returned.";

    const updated = [...recent.slice(-4), text];
    await userRef.set(
      {
        lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
        lastChallengeText: text,
        recentChallenges: updated,
        dailyChallenge: text,
      },
      { merge: true },
    );

    res.status(200).json({ response: text });
  } catch (err: any) {
    console.error("🛑 Gus Bug Tampered Token: Couldn't verify. 🧙‍♂️✨", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: "Gemini failed" });
  }
});

export const startSubscriptionCheckout = onRequest(async (req, res) => {
  console.log("📦 Stripe payload:", req.body);
  console.log(
    "🔐 Stripe Secret:",
    process.env.STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, priceId, success_url, cancel_url } = req.body || {};
  if (!userId || !priceId || !success_url || !cancel_url) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    console.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      console.warn("⚠️ UID mismatch between token and payload");
    }
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url,
      cancel_url,
      "metadata[userId]": userId,
    });

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      console.error("❌ Stripe Error:", data);
      res.status(500).json({ error: data.error || "Stripe failed" });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error("Subscription checkout error", err);
    res.status(500).json({ error: (err as any)?.message || "Failed to start checkout" });
  }
});

export const startOneTimeTokenCheckout = onRequest(async (req, res) => {
  console.log("📦 Stripe payload:", req.body);
  console.log(
    "🔐 Stripe Secret:",
    process.env.STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, priceId, success_url, cancel_url } = req.body || {};
  if (!userId || !priceId || !success_url || !cancel_url) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    console.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      console.warn("⚠️ UID mismatch between token and payload");
    }
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url,
      cancel_url,
      "metadata[userId]": userId,
    });

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data: any = await resp.json();
    if (!resp.ok) {
      console.error("❌ Stripe Error:", data);
      res.status(500).json({ error: data.error || "Stripe failed" });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error("Token checkout error", err);
    res.status(500).json({ error: (err as any)?.message || "Failed to start checkout" });
  }
});

export const startCheckoutSession = onRequest(async (req, res) => {
  console.log("📦 Stripe payload:", req.body);
  console.log(
    "🔐 Stripe Secret:",
    process.env.STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, priceId, success_url, cancel_url, mode = "payment" } = req.body || {};
  if (!userId || !priceId || !success_url || !cancel_url) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    console.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      console.warn("⚠️ UID mismatch between token and payload");
    }
    const params = new URLSearchParams({
      mode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url,
      cancel_url,
      "metadata[userId]": userId,
    });

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      console.error("❌ Stripe Error:", data);
      res.status(500).json({ error: data.error || "Stripe failed" });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error("Checkout session error", err);
    res.status(500).json({ error: (err as any)?.message || "Failed to start checkout" });
  }
});

export const handleStripeWebhookV2 = onRequest(async (req, res) => {
  console.log('💰 Gus Bug Webhook triggered. No auth needed!');
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) {
    console.error('❌ Missing Stripe signature header');
    res.status(400).send('Signature required');
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Stripe signature verification failed', err);
    res.status(400).send('Webhook signature mismatch');
    return;
  }
  if (event?.type === 'checkout.session.completed') {
    const uid = (event.data?.object as any)?.client_reference_id as string | undefined;
    if (uid) {
      console.log('✅ Stripe checkout completed for', uid);
      await db.doc(`subscriptions/${uid}`).set({ active: true }, { merge: true });
      await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
    } else {
      console.warn('⚠️ Missing uid in Stripe webhook payload');
    }
  }
  res.status(200).send({ received: true });
});
