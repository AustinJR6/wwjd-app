import { onRequest } from "firebase-functions/v2/https";
import { auth, db } from "./firebase";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as logger from "firebase-functions/logger";

dotenv.config();
dotenv.config({ path: ".env.functions" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
if (!GEMINI_API_KEY) {
  logger.error("❌ GEMINI_API_KEY missing. Set this in your environment.");
} else {
  logger.info("✅ GEMINI_API_KEY loaded");
}
const LOGGING_MODE = process.env.LOGGING_MODE || "gusbug";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || "https://example.com/success";
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";
const STRIPE_20_TOKEN_PRICE_ID = process.env.STRIPE_20_TOKEN_PRICE_ID || "";
const STRIPE_50_TOKEN_PRICE_ID = process.env.STRIPE_50_TOKEN_PRICE_ID || "";
const STRIPE_100_TOKEN_PRICE_ID = process.env.STRIPE_100_TOKEN_PRICE_ID || "";

if (!STRIPE_SECRET_KEY) {
  logger.error("❌ STRIPE_SECRET_KEY missing. Set this in your environment.");
} else {
  logger.info("✅ STRIPE_SECRET_KEY loaded");
}
if (!STRIPE_WEBHOOK_SECRET) {
  logger.warn("⚠️ STRIPE_WEBHOOK_SECRET not set. Webhook verification will fail.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
} as any);

function createGeminiModel() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  } catch (err) {
    logger.error("Failed to initialize GoogleGenerativeAI", err);
    throw err;
  }
}

async function addTokens(uid: string, amount: number): Promise<void> {
  const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
    t.set(
      userRef,
      {
        tokens: current + amount,
        lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function deductTokens(uid: string, amount: number): Promise<boolean> {
  const userRef = db.collection("users").doc(uid);
  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
      if (current < amount) {
        throw new Error("INSUFFICIENT_TOKENS");
      }
      t.set(
        userRef,
        {
          tokens: current - amount,
          lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return true;
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_TOKENS") {
      return false;
    }
    throw err;
  }
}

async function updateStreakAndXPInternal(uid: string, type: string) {
  const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const data = snap.exists ? snap.data() || {} : {};
    const now = admin.firestore.Timestamp.now();
    const last: admin.firestore.Timestamp | undefined = data.lastCheckIn;
    const streak = data.streakCount || 0;
    const xp = data.xpPoints || 0;
    const longest = data.longestStreak || 0;

    let newStreak = 1;
    if (last) {
      const diffMs = now.toMillis() - last.toMillis();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 1) {
        newStreak = streak; // same day
      } else if (diffDays < 2) {
        newStreak = streak + 1;
      }
    }
    const xpEarned = 10;
    t.set(
      userRef,
      {
        lastCheckIn: now,
        streakCount: newStreak,
        xpPoints: xp + xpEarned,
        longestStreak: Math.max(longest, newStreak),
      },
      { merge: true },
    );
  });
}

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
    await updateStreakAndXPInternal(decodedToken.uid, "challenge");
    res.status(200).send({ message: "Streak and XP updated" });
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

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    logger.info(`✅ askGeminiSimple user: ${uid}`);

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({
        history: (history as any[]).map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      });
      const result = await chat.sendMessage(prompt);
      text = result?.response?.text?.() ?? "No response text returned.";
    } catch (gemErr) {
      console.error("Gemini request failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

    res.status(200).json({ response: text });
  } catch (err: any) {
    console.error("🛑 Gemini Simple auth or processing error", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: err.message || "Gemini failed" });
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
    logger.info(`✅ askGeminiV2 user: ${decoded.uid}`);

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({
        history: (history as any[]).map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      });
      const result = await chat.sendMessage(prompt);
      text = result?.response?.text?.() ?? "No response text returned.";
    } catch (gemErr) {
      console.error("Gemini V2 request failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

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
    logger.info(`✅ generateChallenge user: ${uid}`);

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

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({
        history: (history as any[]).map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      });
      const result = await chat.sendMessage(`${fullPrompt}\n${randomizer}`);
      text = result?.response?.text?.() ?? "No response text returned.";
    } catch (gemErr) {
      console.error("Gemini generateChallenge failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

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

export const generateDailyChallenge = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "" } = req.body || {};

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    logger.info(`✅ generateDailyChallenge user: ${uid}`);

    const userRef = db.collection("users").doc(uid);
    const historyRef = userRef.collection("challengeHistory");
    const histSnap = await historyRef
      .orderBy("timestamp", "desc")
      .limit(3)
      .get();

    const recent = histSnap.docs.map((d) => d.data()?.text).filter(Boolean);
    const avoidList = recent
      .map((c, i) => `#${i + 1}: ${c}`)
      .join("\n");

    const basePrompt =
      prompt.trim() ||
      "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
    const fullPrompt = `${basePrompt}\n${avoidList}\nReturn only the challenge.`;

    logger.info("📝 Gemini prompt:", fullPrompt);

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({ history: [] });
      const result = await chat.sendMessage(fullPrompt);
      text = result?.response?.text?.() || "";
    } catch (gemErr) {
      console.error("Gemini generateDailyChallenge failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

    text = text.trim();
    if (!text) {
      res.status(500).json({ error: "Empty challenge" });
      return;
    }

    if (recent.includes(text)) {
      logger.warn("Duplicate challenge generated, retrying once");
      try {
        const model = createGeminiModel();
        const chat = await model.startChat({ history: [] });
        const result = await chat.sendMessage(`${fullPrompt}\nEnsure it is different.`);
        text = result?.response?.text?.() || text;
        text = text.trim();
      } catch (retryErr) {
        console.error("Retry failed", retryErr);
      }
    }

    logger.info("🌟 Challenge output:", text);

    await historyRef.add({
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const allSnap = await historyRef.orderBy("timestamp", "desc").get();
    const docs = allSnap.docs;
    for (let i = 3; i < docs.length; i++) {
      await docs[i].ref.delete();
    }

    await userRef.set(
      {
        lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
        lastChallengeText: text,
        dailyChallenge: text,
      },
      { merge: true },
    );

    res.status(200).json({ response: text });
  } catch (err: any) {
    console.error("🛑 generateDailyChallenge error", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: err.message || "Gemini failed" });
  }
});

export const skipDailyChallenge = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userRef = db.collection("users").doc(uid);

    let cost = 0;
    let newSkipCount = 0;
    let weekStart = new Date();

    const tokenOk = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const data = snap.exists ? snap.data() || {} : {};
      const now = new Date();
      weekStart = data.skipWeekStart ? new Date(data.skipWeekStart) : now;
      newSkipCount = data.skipCountThisWeek || 0;
      if (!data.skipWeekStart || now.getTime() - weekStart.getTime() > 7 * 24 * 60 * 60 * 1000) {
        newSkipCount = 0;
        weekStart = now;
      }
      cost = newSkipCount === 0 ? 0 : Math.pow(2, newSkipCount);
      const tokens = data.tokens || 0;
      if (tokens < cost) {
        return false;
      }
      t.set(
        userRef,
        {
          tokens: tokens - cost,
          skipCountThisWeek: newSkipCount + 1,
          skipWeekStart: weekStart.toISOString(),
          lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });

    if (!tokenOk) {
      res.status(400).json({ error: "Not enough tokens" });
      return;
    }

    // generate new challenge after deduction
    const prompt = req.body?.prompt || "";

    const historyRef = userRef.collection("challengeHistory");
    const histSnap = await historyRef
      .orderBy("timestamp", "desc")
      .limit(3)
      .get();

    const recent = histSnap.docs.map((d) => d.data()?.text).filter(Boolean);
    const avoidList = recent
      .map((c, i) => `#${i + 1}: ${c}`)
      .join("\n");

    const basePrompt =
      prompt.trim() ||
      "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
    const fullPrompt = `${basePrompt}\n${avoidList}\nReturn only the challenge.`;

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({ history: [] });
      const result = await chat.sendMessage(fullPrompt);
      text = result?.response?.text?.() || "";
    } catch (gemErr) {
      console.error("Gemini skipDailyChallenge failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

    text = text.trim();
    if (!text) {
      res.status(500).json({ error: "Empty challenge" });
      return;
    }

    await historyRef.add({
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const allSnap = await historyRef.orderBy("timestamp", "desc").get();
    const docs = allSnap.docs;
    for (let i = 3; i < docs.length; i++) {
      await docs[i].ref.delete();
    }

    await userRef.set(
      {
        lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
        lastChallengeText: text,
        dailyChallenge: text,
      },
      { merge: true },
    );

    res.status(200).json({ response: text, cost });
  } catch (err: any) {
    console.error("🛑 skipDailyChallenge error", err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(500).json({ error: err.message || "Failed" });
  }
});

export const startSubscriptionCheckout = onRequest(async (req, res) => {
  logger.info("📦 startSubscriptionCheckout payload", req.body);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
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
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      metadata: { uid: userId },
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error", err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
});

export const startOneTimeTokenCheckout = onRequest(async (req, res) => {
  logger.info("📦 startOneTimeTokenCheckout payload", req.body);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
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
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      metadata: { uid: userId },
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Token checkout error", err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
});

export const startDonationCheckout = onRequest(async (req, res) => {
  logger.info("💖 startDonationCheckout payload", req.body);
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { userId, amount } = req.body || {};
  if (!userId || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    logger.info(`📨 Creating donation session for ${userId} amount $${amount}`);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "OneVine Donation" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: userId,
      metadata: { uid: userId, donationAmount: amount },
    });
    logger.info(`✅ Donation session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    logger.error("Donation checkout error", err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start donation" });
  }
});

export const startCheckoutSession = onRequest(async (req, res) => {
  logger.info("📦 startCheckoutSession payload", req.body);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
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
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      metadata: { uid: userId },
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error", err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
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
    const session = event.data?.object as Stripe.Checkout.Session;
    const uid = session.client_reference_id as string | undefined;
    if (!uid) {
      console.warn('⚠️ Missing uid in Stripe webhook payload');
    } else {
      console.log('✅ Stripe checkout completed for', uid);
      if (session.mode === 'subscription') {
        await db.doc(`subscriptions/${uid}`).set({ active: true }, { merge: true });
        await db.doc(`users/${uid}`).set({ isSubscribed: true }, { merge: true });
      } else {
        try {
          const retrieved = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items'] as any,
          });
          const items = (retrieved.line_items?.data || []) as any[];
          let total = 0;
          for (const item of items) {
            const price = item.price?.id as string | undefined;
            if (!price) continue;
            if (price === STRIPE_20_TOKEN_PRICE_ID) total += 20;
            else if (price === STRIPE_50_TOKEN_PRICE_ID) total += 50;
            else if (price === STRIPE_100_TOKEN_PRICE_ID) total += 100;
          }
          if (total > 0) {
            await addTokens(uid, total);
            logger.info(`💰 Added ${total} tokens to ${uid}`);
          }
        } catch (err) {
          logger.error('Token purchase handling failed', err);
        }
      }
    }
  }
  res.status(200).send({ received: true });
});

export const updateStreakAndXP = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const type = req.body?.type || "general";
    await updateStreakAndXPInternal(decoded.uid, type);
    res.status(200).json({ message: "Streak updated" });
  } catch (err: any) {
    console.error("updateStreakAndXP error", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
});
