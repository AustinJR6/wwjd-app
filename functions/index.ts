import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as logger from 'firebase-functions/logger';
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();
// export const createSubscription = functions.https.onRequest(async (req, res) => {
//   try {
//    const { customerId, paymentMethodId, uid } = req.body;
//    if (!customerId || !paymentMethodId || !uid) {
//      res.status(400).json({ error: 'Missing required fields' });
//      return;
//    }
//    const priceId = 'price_1RFjFaGLKcFWSqCIrIiOVfwM';
//    const subscription = await stripe.subscriptions.create({
//      customer: customerId,
//      default_payment_method: paymentMethodId,
//      items: [{ price: priceId }],
//      metadata: { uid },
//    });
//    res.status(200).json({ subscriptionId: subscription.id });
//  } catch (err: any) {
//    logger.error('createSubscription failed', err);
//    res.status(500).json({ error: err?.message || 'Failed to create subscription' });
//  }
//});
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createGeminiModel, fetchReligionContext } from './geminiUtils';
import {
  withCors,
  verifyIdToken,
  writeDoc,
  logError,
  verifyAuth,
  extractAuthToken,
} from "./helpers";


function logTokenVerificationError(context: string, token: string | undefined, err: any) {
  logger.error(`${context} token verification failed`, {
    tokenPrefix: token ? token.slice(0, 10) : "none",
    errorCode: (err as any)?.code,
    message: (err as any)?.message,
  });
}

dotenv.config();
dotenv.config({ path: ".env.functions" });

const GEMINI_API_KEY = functions.config().gemini?.key || "";
if (!GEMINI_API_KEY) {
  logger.warn(
    "Gemini API key not found in functions config. Set with 'firebase functions:config:set gemini.key=YOUR_KEY'"
  );
} else {
  logger.info("✅ GEMINI_API_KEY loaded from functions config");
}
const LOGGING_MODE = process.env.LOGGING_MODE || "gusbug";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.FRONTEND_URL ||
  "https://onevine.app";
const STRIPE_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL ||
  `${APP_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";
function cleanPriceId(raw: string): string {
  return raw.split('#')[0].trim();
}

const STRIPE_20_TOKEN_PRICE_ID = cleanPriceId(
  process.env.STRIPE_20_TOKEN_PRICE_ID || ''
);
const STRIPE_50_TOKEN_PRICE_ID = cleanPriceId(
  process.env.STRIPE_50_TOKEN_PRICE_ID || ''
);
const STRIPE_100_TOKEN_PRICE_ID = cleanPriceId(
  process.env.STRIPE_100_TOKEN_PRICE_ID || ''
);

function getTokensFromPriceId(priceId: string): number | null {
  if (priceId === STRIPE_20_TOKEN_PRICE_ID) return 20;
  if (priceId === STRIPE_50_TOKEN_PRICE_ID) return 50;
  if (priceId === STRIPE_100_TOKEN_PRICE_ID) return 100;
  return null;
}

const CURRENT_PROFILE_SCHEMA = 1;

function validateSignupProfile(profile: any): Required<Pick<any,
  'email' | 'displayName' | 'username' | 'religion' | 'preferredName'>> & {
  region?: string;
  organization?: string | null;
  pronouns?: string;
  avatarURL?: string;
} {
  if (!profile || typeof profile !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'profile must be an object');
  }

  const requiredFields = [
    'email',
    'displayName',
    'username',
    'religion',
    'preferredName',
  ];

  const sanitized: any = {};
  for (const field of requiredFields) {
    const val = profile[field];
    if (typeof val !== 'string' || !val.trim()) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid ${field}`);
    }
    sanitized[field] = val.trim();
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized.email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(sanitized.username)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid username');
  }

  if (typeof profile.avatarURL === 'string' && profile.avatarURL.trim()) {
    try {
      new URL(profile.avatarURL);
    } catch {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid avatarURL');
    }
    sanitized.avatarURL = profile.avatarURL.trim();
  }

  if ('pronouns' in profile && typeof profile.pronouns === 'string') {
    sanitized.pronouns = profile.pronouns.trim();
  }

  if ('region' in profile) {
    if (typeof profile.region !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'region must be a string');
    }
    sanitized.region = profile.region.trim();
  }

  if ('organization' in profile) {
    if (
      profile.organization !== null &&
      typeof profile.organization !== 'string'
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'organization must be a string or null',
      );
    }
    sanitized.organization = profile.organization ?? null;
  }

  return sanitized;
}

if (!process.env.STRIPE_SUB_PRICE_ID) {
  logger.warn("⚠️ Missing STRIPE_SUB_PRICE_ID in .env");
}

if (!STRIPE_SECRET_KEY) {
  logger.error(
    "❌ STRIPE_SECRET_KEY missing. Set this in your environment."
  );
} else {
  logger.info("✅ Stripe key loaded");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
} as any);

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
  const baseRef = db.collection("users").doc(uid);
  const ref =
    type === "journal"
      ? db.doc(`users/${uid}/journalStreak/current`)
      : baseRef;

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
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
      ref,
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

async function findUidByCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export const incrementReligionPoints = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      try {
        const { uid } = await verifyIdToken(req);
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

        const ref = db.collection("religion").doc(religion);
        logger.info("🛠 Updating religion doc with merge", { religion });
        await db.runTransaction(async (t: FirebaseFirestore.Transaction) => {
          const snap = await t.get(ref);
          const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
          t.set(ref, { totalPoints: current + points }, { merge: true });
        });
        logger.info("✅ Religion updated", { religion });

        res.status(200).send({ message: "Points updated" });
      } catch (err: any) {
        logError("incrementReligionPoints", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
      }
    })
  );

export const awardPointsToUser = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      try {
        const { uid } = await verifyIdToken(req);
        const { points } = req.body;

        if (typeof points !== "number" || points <= 0 || points > 100) {
          res.status(400).send("Invalid input.");
          return;
        }

        const userSnap = await db.doc(`users/${uid}`).get();
        if (!userSnap.exists) {
          res.status(404).send("User not found");
          return;
        }
        const userData = userSnap.data() || {};
        const religionId = userData?.religion ?? "SpiritGuide";
        const organizationId = userData.organizationId;

        await db.runTransaction(async (t) => {
          if (religionId) {
            const ref = db.doc(`religion/${religionId}`);
            logger.info("🛠 Updating religion doc with merge", { religionId });
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: religionId, totalPoints: current + points }, { merge: true });
            logger.info("✅ Religion updated", { religionId });
          }
          if (organizationId) {
            const ref = db.doc(`organizations/${organizationId}`);
            logger.info("🛠 Updating organization doc with merge", { organizationId });
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: organizationId, totalPoints: current + points }, { merge: true });
            logger.info("✅ Organization updated", { organizationId });
          }
        });

        res.status(200).send({ message: "Points awarded" });
      } catch (err: any) {
        logError("awardPointsToUser", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
      }
    })
  );

export const completeChallenge = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  if (!token) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }
  try {
    const decodedToken = await auth.verifyIdToken(token);
    console.log(`✅ Gus Bug Authenticated: ${decodedToken.uid} is legit! 🎯`);
    await updateStreakAndXPInternal(decodedToken.uid, "challenge");
    res.status(200).send({ message: "Streak and XP updated" });
  } catch (err) {
    logTokenVerificationError('completeChallenge', token, err);
    res.status(401).json({
      error: "Unauthorized — Gus bug cast an invalid token spell.",
    });
    return;
  }
});

export const createMultiDayChallenge = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt = "", days = 1, basePoints = 10, religion: religionId } = req.body || {};
  if (typeof days !== "number" || days < 1 || days > 7) {
    res.status(400).json({ error: "days must be between 1 and 7" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = db.collection("users").doc(uid);
    const challengeRef = db.doc(`users/${uid}/activeChallenge/current`);

    const { name, aiVoice } = await fetchReligionContext(religionId);
    const basePrompt =
      prompt.trim() ||
      `Generate a ${days}-day spiritual challenge. Give concise instructions for each day.`;
    const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}`;

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({ history: [] });
      const result = await chat.sendMessage(fullPrompt);
      text = result?.response?.text?.() || "";
    } catch (err) {
      logger.error("Gemini createMultiDayChallenge failed", err);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

    text = text.trim();
    if (!text) {
      res.status(500).json({ error: "Empty challenge" });
      return;
    }

    await challengeRef.set(
      {
        challengeText: text,
        totalDays: days,
        currentDay: 1,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        lastCompleted: null,
        completedDays: [],
        isComplete: false,
        basePoints,
        doubleBonusEligible: true,
      },
      { merge: true },
    );

    await userRef.set(
      {
        lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
        lastChallengeText: text,
      },
      { merge: true },
    );

    res.status(200).json({ challengeText: text });
  } catch (err: any) {
    logger.error("createMultiDayChallenge error", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
});

export const completeChallengeDay = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const challengeRef = db.doc(`users/${uid}/activeChallenge/current`);
    const userRef = db.collection("users").doc(uid);

    let bonus = 0;

    await db.runTransaction(async (t) => {
      const snap = await t.get(challengeRef);
      if (!snap.exists) {
        throw new Error("NO_CHALLENGE");
      }
      const data = snap.data() || {};
      if (data.isComplete) {
        throw new Error("ALREADY_COMPLETE");
      }

      const now = admin.firestore.Timestamp.now();
      const last: admin.firestore.Timestamp | null = data.lastCompleted || null;
      let doubleBonusEligible = data.doubleBonusEligible !== false;
      if (last) {
        const diff = now.toMillis() - last.toMillis();
        if (diff > 48 * 60 * 60 * 1000) {
          doubleBonusEligible = false;
        }
        if (diff < 12 * 60 * 60 * 1000) {
          throw new Error("ALREADY_COMPLETED_TODAY");
        }
      }

      const currentDay = data.currentDay || 1;
      const totalDays = data.totalDays || 1;
      const completed: number[] = Array.isArray(data.completedDays)
        ? data.completedDays
        : [];
      if (completed.includes(currentDay)) {
        throw new Error("DAY_ALREADY_COMPLETED");
      }

      completed.push(currentDay);
      const newCurrent = currentDay + 1;
      const isComplete = newCurrent > totalDays;

      t.set(
        challengeRef,
        {
          completedDays: completed,
          currentDay: newCurrent,
          lastCompleted: now,
          isComplete,
          doubleBonusEligible,
        },
        { merge: true },
      );

      const logRef = challengeRef.collection("challengeLogs").doc();
      t.set(logRef, { day: currentDay, timestamp: now });

      const userSnap = await t.get(userRef);
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const relRef: FirebaseFirestore.DocumentReference | null =
        userData.religionRef || (userData.religion ? db.doc(`religion/${userData.religion}`) : null);

      const basePoints = data.basePoints || 10;
      let points = basePoints;
      if (isComplete && doubleBonusEligible && completed.length === totalDays) {
        bonus = basePoints * totalDays;
        points += bonus;
      }

      t.update(userRef, {
        individualPoints: admin.firestore.FieldValue.increment(points),
      });
      if (relRef) {
        const rs = await t.get(relRef);
        const current = rs.exists ? (rs.data()?.totalPoints ?? 0) : 0;
        logger.info("🛠 Updating religion doc with merge", { ref: relRef.path });
        t.set(relRef, { totalPoints: current + points }, { merge: true });
        logger.info("✅ Religion updated", { ref: relRef.path });
      }
    });

    await updateStreakAndXPInternal(uid, "challenge");

    res.status(200).json({ message: "Day completed", bonusAwarded: bonus });
  } catch (err: any) {
    logger.error("completeChallengeDay error", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
});

export const askGeminiSimple = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", history = [], religion: religionId } = req.body || {};

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

      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() || {};
      let promptPrefix = "";
      if (userData.religionRef) {
        try {
          const relSnap = await userData.religionRef.get();
          promptPrefix = relSnap.data()?.prompt || "";
        } catch {}
      }
      const { name, aiVoice } = await fetchReligionContext(religionId);
      const system = promptPrefix || `As a ${aiVoice} within the ${name} tradition,`;
      const fullPrompt = `${system} respond to the following:\n"${prompt}"`;
      const result = await chat.sendMessage(fullPrompt);
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

export const confessionalAI = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { history = [], religion: religionId } = req.body || {};

  try {
    const decoded = await auth.verifyIdToken(idToken);
    logger.info(`✅ confessionalAI user: ${decoded.uid}`);
    const { name, aiVoice } = await fetchReligionContext(religionId);
    const promptText = history
      .map((m: any) => `${m.role}: ${m.text}`)
      .join("\n");
    const system = `As a ${aiVoice} within the ${name} tradition, offer a brief compassionate response to the confession below.`;
    const model = createGeminiModel();
    const chat = await model.startChat({ history: [] });
    const result = await chat.sendMessage(`${system}\n${promptText}`);
    const reply = result?.response?.text?.() || "";
    res.status(200).json({ reply });
  } catch (err: any) {
    logTokenVerificationError('confessionalAI', idToken, err);
    const isAuthErr =
      err.code === "auth/argument-error" || err.code === "auth/id-token-expired";
    const code = isAuthErr ? 401 : 500;
    res.status(code).json({ error: err.message || "Failed" });
  }
});

export const askGeminiV2 = functions
  .https.onRequest(async (req: Request, res: Response) => {
    const userInput = req.body?.prompt;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (typeof userInput !== "string" || !userInput.trim()) {
      res.status(400).json({ error: "Invalid prompt" });
      return;
    }

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const apiKey = functions.config().gemini.key;
    if (!apiKey) {
      functions.logger.warn(
        "Gemini API key not found in functions config"
      );
      res.status(500).json({ error: "Gemini API key not configured" });
      return;
    }

    console.log("🔍 Incoming prompt", userInput);

    try {
      const decoded = await auth.verifyIdToken(idToken);
      const uid = decoded.uid;
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() || {};

      const userReligion: string | undefined = userData.religion;
      let religionPrompt = "";
      let religionName = userReligion || "unknown";
      if (userReligion) {
        const relSnap = await db.collection("religion").doc(userReligion).get();
        if (relSnap.exists) {
          const data = relSnap.data() || {};
          religionPrompt = (data as any).prompt || "";
          religionName = (data as any).name || userReligion;
        }
      }

      const finalPrompt = `${religionPrompt}\n${userInput}`;
      functions.logger.info(`askGeminiV2 religion: ${religionName}`);
      functions.logger.info(`askGeminiV2 full prompt: ${finalPrompt}`);

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
      const chat = await model.startChat({
        history: history.map((msg: any) => ({
          role: msg.role,
          parts: msg.parts || [{ text: msg.text }],
        })),
      });
      console.log('📖 Chat history', JSON.stringify(history));
      const result = await chat.sendMessage(finalPrompt);
      console.log('📨 Gemini full response', JSON.stringify(result, null, 2));
      const reply = result?.response?.text?.() || '';

      if (!reply) {
        console.error("Gemini returned empty reply");
        res.status(500).json({ error: "Empty response from Gemini" });
        return;
      }

      console.log("✅ Final reply sent to client", reply);
      res.status(200).json({ response: reply });
    } catch (err) {
      console.error("askGeminiV2 request failed", err);
      res.status(500).json({ error: "Gemini request failed" });
    }
  });

export const generateChallenge = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", history = [], seed = Date.now(), religion: religionId } = req.body || {};

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

    const { name, aiVoice } = await fetchReligionContext(religionId);
    const basePrompt =
      prompt.trim() ||
      `Generate a new, unique, and creative spiritual challenge.`;
    const fullPrompt =
      `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n\nDo NOT repeat or closely resemble any of the following recent challenges:\n${avoid}\n\nRespond ONLY with the new challenge text.`;

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
    logTokenVerificationError('generateChallenge', idToken, err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: err.message || "Gemini failed" });
  }
});

export const generateDailyChallenge = functions
  .https.onRequest(async (req: Request, res: Response) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    console.error("❌ Gus Bug Alert: Missing ID token in header. 🐞");
    res.status(401).json({ error: "Unauthorized — Gus bug stole the token!" });
    return;
  }

  const { prompt = "", religion: religionId } = req.body || {};

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

    const { name, aiVoice } = await fetchReligionContext(religionId);
    const basePrompt =
      prompt.trim() ||
      "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
    const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n${avoidList}\nReturn only the challenge.`;

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

export const skipDailyChallenge = functions
  .https.onRequest(async (req: Request, res: Response) => {
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
      const tokens = data?.tokens ?? 0;
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
    const religionId = req.body?.religion;

    const historyRef = userRef.collection("challengeHistory");
    const histSnap = await historyRef
      .orderBy("timestamp", "desc")
      .limit(3)
      .get();

    const recent = histSnap.docs.map((d) => d.data()?.text).filter(Boolean);
    const avoidList = recent
      .map((c, i) => `#${i + 1}: ${c}`)
      .join("\n");

    const { name, aiVoice } = await fetchReligionContext(religionId);
    const basePrompt =
      prompt.trim() ||
      "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
    const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n${avoidList}\nReturn only the challenge.`;

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
    logTokenVerificationError('skipDailyChallenge', idToken, err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// TODO: startSubscriptionCheckout is unused in the current frontend. Consider
// removing or wiring it up in a future release.
export const startSubscriptionCheckout = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("📦 startSubscriptionCheckout payload", req.body);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );

  const { uid, priceId } = req.body || {};
  if (!uid || !priceId) {
    logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
    res.status(400).json({ error: "Missing uid or priceId" });
    return;
  }
  const cleanId = cleanPriceId(priceId);

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("startSubscriptionCheckout", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== uid) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: cleanId, // Replace with your actual Stripe Price ID
          quantity: 1,
        },
      ],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: uid,
      metadata: { uid, type: "subscription" },
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ checkoutUrl: session.url });
  } catch (err) {
    logTokenVerificationError('startSubscriptionCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

// TODO: startOneTimeTokenCheckout is unused in the current frontend. Consider
// removing or wiring it up in a future release.
export const startOneTimeTokenCheckout = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("📦 startOneTimeTokenCheckout payload", req.body);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );
  const { userId, priceId, success_url, cancel_url } = req.body || {};
  if (!userId || !priceId || !success_url || !cancel_url) {
    logger.warn("⚠️ Missing fields", {
      userId,
      priceId,
      success_url,
      cancel_url,
    });
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const cleanId = cleanPriceId(priceId);

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("startOneTimeTokenCheckout", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const tokens = getTokensFromPriceId(cleanId);
    const metadata: Record<string, string> = { uid: userId, type: "tokens" };
    if (tokens) metadata.tokens = String(tokens);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: cleanId, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      metadata,
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    logTokenVerificationError('startOneTimeTokenCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

export const startTokenCheckout = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("🪙 startTokenCheckout payload", req.body);
  const { uid, priceId } = req.body || {};
  if (!uid || !priceId) {
    logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
    res.status(400).json({ error: "Missing uid or priceId" });
    return;
  }
  const cleanId = cleanPriceId(priceId);

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("startTokenCheckout", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== uid) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const tokens = getTokensFromPriceId(cleanId);
    const metadata: Record<string, string> = { uid, type: "tokens" };
    if (tokens) metadata.tokens = String(tokens);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: cleanId, quantity: 1 }],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: uid,
      metadata,
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ checkoutUrl: session.url });
  } catch (err) {
    logTokenVerificationError('startTokenCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

export const createCheckoutSession = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info('createCheckoutSession payload', req.body);
    const { uid, priceId, tokenAmount } = req.body || {};

    if (!uid || !priceId) {
      logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const cleanId = cleanPriceId(priceId);

    if (typeof tokenAmount !== 'number' || tokenAmount <= 0) {
      logger.warn('⚠️ Missing or invalid tokenAmount', { tokenAmount });
      res.status(400).json({ error: 'tokenAmount required' });
      return;
    }

    const stripeSecret = functions.config().stripe?.secret;
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;
      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        logger.info('Stripe customer reused', { uid, customerId });
      }

      const ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );

      const price = await stripeClient.prices.retrieve(cleanId);
      const amount = price.unit_amount;
      if (!amount) {
        res.status(400).json({ error: 'Unable to resolve price amount' });
        return;
      }

      const intent = await stripeClient.paymentIntents.create({
        amount,
        currency: price.currency,
        customer: customerId,
        metadata: {
          uid,
          purchaseType: 'token',
          tokenAmount: String(tokenAmount),
        },
        automatic_payment_methods: { enabled: true },
      });

      logger.info(`✅ PaymentIntent created ${intent.id}`);
      res.status(200).json({
        clientSecret: intent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
      });
    } catch (err) {
      logger.error('createCheckoutSession failed', err);
      res.status(500).json({ error: (err as any)?.message || 'Failed to create checkout' });
    }
  }));

export const createStripeSubscriptionIntent = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
    logger.info('createStripeSubscriptionIntent payload', req.body);
    const { uid, priceId, tier = 'premium' } = req.body || {};

    if (!uid || !priceId) {
      logger.warn('⚠️ Missing uid or priceId', { uid, priceId });
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const stripeSecret = functions.config().stripe?.secret;
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;
      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid, tier },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        await stripeClient.customers.update(customerId, { metadata: { uid, tier } });
        logger.info('Stripe customer reused', { uid, customerId });
      }

      const ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );

      const subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: cleanPriceId(priceId) }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { uid, tier },
      });

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
      const clientSecret = latestInvoice?.payment_intent?.client_secret as string | undefined;
      if (!clientSecret) {
        logger.error('Failed to obtain client secret', {
          subscriptionId: subscription.id,
          latestInvoice,
        });
        res.status(500).json({ error: 'Failed to obtain client secret' });
        return;
      }

      res.status(200).json({
        clientSecret,
        customerId,
        ephemeralKey: ephemeralKey.secret,
      });
    } catch (err) {
      logger.error('createStripeSubscriptionIntent failed', err);
      res.status(500).json({ error: (err as any)?.message || 'Failed to create subscription' });
    }
  }));

export const startDonationCheckout = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("💖 startDonationCheckout payload", req.body);
  const { userId, amount } = req.body || {};
  if (!userId || typeof amount !== "number" || amount <= 0) {
    logger.warn("⚠️ Missing fields", { userId: !!userId, amount });
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("startDonationCheckout", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== userId) {
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
    logTokenVerificationError('startDonationCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start donation" });
  }
}));

export const startCheckoutSession = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("📦 startCheckoutSession payload", req.body);
  logger.debug("startCheckoutSession headers", req.headers);
  logger.info(
    "🔐 Stripe Secret:",
    STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing",
  );
  const { userId, priceId, success_url, cancel_url, mode = "payment" } = req.body || {};
  if (!userId || !priceId || !success_url || !cancel_url) {
    logger.warn("⚠️ Missing fields", {
      userId,
      priceId,
      success_url,
      cancel_url,
    });
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const cleanId = cleanPriceId(priceId);

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("startCheckoutSession", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== userId) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const tokens = getTokensFromPriceId(cleanId);
    const metadata: Record<string, string> = { uid: userId };
    if (tokens) metadata.tokens = String(tokens);
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: cleanId, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      metadata,
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    logTokenVerificationError('startCheckoutSession', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

export const createStripeCheckout = functions
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("🛒 createStripeCheckout payload", req.body);
  const { uid, email, priceId, type, quantity, returnUrl } = req.body || {};

  if (typeof uid !== "string" || !uid.trim() ||
      typeof priceId !== "string" || !priceId.trim()) {
    logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
    res.status(400).json({ error: "Missing uid or priceId" });
    return;
  }

  const cleanId = cleanPriceId(priceId);
  logger.debug("Creating Stripe session with", { uid, priceId: cleanId });

  const missing: string[] = [];
  if (!uid) missing.push("uid");
  if (!email) missing.push("email");
  if (!type) missing.push("type");
  if (type === "subscription" && !priceId) missing.push("priceId");
  if (type === "tokens" && !priceId && !quantity) missing.push("priceId or quantity");
  if (missing.length) {
    logger.warn("⚠️ Missing fields", { missing, body: req.body });
    res.status(400).json({ error: `Missing required field: ${missing.join(', ')}` });
    return;
  }

  let authData: { uid: string; token: string };
  try {
    authData = await verifyAuth(req);
  } catch (err) {
    logTokenVerificationError("createStripeCheckout", undefined, err);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let finalPriceId: string | undefined = cleanId;
  if (type === "tokens" && !cleanId) {
    if (quantity === 20) finalPriceId = STRIPE_20_TOKEN_PRICE_ID;
    else if (quantity === 50) finalPriceId = STRIPE_50_TOKEN_PRICE_ID;
    else if (quantity === 100) finalPriceId = STRIPE_100_TOKEN_PRICE_ID;
  }

  if (!finalPriceId) {
    logger.warn("⚠️ Unable to resolve priceId", { type, quantity, priceId });
    res.status(400).json({ error: "Missing required field: priceId" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("❌ Stripe secret key missing");
    res.status(500).json({ error: "Stripe secret not configured" });
    return;
  }

  try {
    if (authData.uid !== uid) {
      logger.warn("⚠️ UID mismatch between token and payload");
    }
    const metadata: Record<string, string> = { uid, type };
    let tokenCount: number | null = null;
    if (type === "tokens") {
      tokenCount = quantity ?? getTokensFromPriceId(finalPriceId!);
      if (tokenCount) metadata.tokens = String(tokenCount);
    }
    const session = await stripe.checkout.sessions.create({
      mode: type === "subscription" ? "subscription" : "payment",
      line_items: [{ price: finalPriceId!, quantity: 1 }],
      success_url: returnUrl || STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: uid,
      customer_email: email,
      metadata,
    });
    logger.info(`✅ Stripe session created ${session.id}`);
    res.status(200).json({ url: session.url });
  } catch (err) {
    logTokenVerificationError('createStripeCheckout', authData.token, err);
    res.status(500).json({ error: (err as any)?.message || 'Failed to start checkout' });
  }
}));


export const updateStreakAndXP = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError("updateStreakAndXP", extractAuthToken(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        const type = req.body?.type || "general";
        await updateStreakAndXPInternal(authData.uid, type);
        res.status(200).json({ message: "Streak updated" });
      } catch (err: any) {
        logError("updateStreakAndXP", err);
        res.status(500).json({ error: err.message || "Failed" });
      }
    }),
  );

export const getUserProfile = functions
  .https.onRequest(
    withCors(async (req: Request, res: Response) => {
      let authData: { uid: string; token: string };
      try {
        authData = await verifyAuth(req);
      } catch (err) {
        logTokenVerificationError("getUserProfile", extractAuthToken(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const reqUid =
        typeof req.query.uid === "string"
          ? (req.query.uid as string)
          : req.body?.uid || authData.uid;

      if (reqUid !== authData.uid) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      try {
        const snap = await db.collection("users").doc(reqUid).get();
        if (!snap.exists) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.status(200).json({ uid: reqUid, ...snap.data() });
      } catch (err: any) {
        logError("getUserProfile", err);
        res.status(500).json({ error: err.message || "Failed" });
      }
    })
  );

async function ensureDocument(
  path: string,
  data: Record<string, any>,
) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.info("🛠 Creating doc with merge", { path });
    await ref.set(data, { merge: true });
    logger.info("✅ Doc ensured", { path });
  }
}

export const seedFirestore = functions
  .https.onRequest(async (_req: Request, res: Response) => {
  try {
    await Promise.all([
      ensureDocument('users/seed-user', { initialized: true }),
      ensureDocument('subscriptions/seed-user', {
        active: false,
        tier: 'free',
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
      }),
      ensureDocument('tokens/settings', {
        adRewardAmount: 2,
        freeAskCooldownHours: 24,
        freeSkipCooldownHours: 24,
        freeTokensOnSignup: 5,
        pricePerToken: 0.05,
      }),
      ensureDocument('tokens/seed-user', { tokens: 0 }),
      ensureDocument('challengeProofs/dummy', { initialized: true }),
      ensureDocument('freeAsk/seed-user', { initialized: true }),
      ensureDocument('dailyChallenges/dummy', { placeholder: true }),
      ensureDocument('activeChallenges/dummy', { placeholder: true }),
      ensureDocument('completedChallenges/dummy', { placeholder: true }),
      ensureDocument('religion/dummy', { name: 'Dummy Religion' }),
      ensureDocument('organizations/dummy', { name: 'Dummy Org' }),
      ensureDocument('regions/southwest', {
        id: 'southwest',
        name: 'Southwest',
        code: 'SW',
        sortOrder: 1,
      }),
      ensureDocument('regions/northeast', {
        id: 'northeast',
        name: 'Northeast',
        code: 'NE',
        sortOrder: 2,
      }),
      ensureDocument('regions/midwest', {
        id: 'midwest',
        name: 'Midwest',
        code: 'MW',
        sortOrder: 3,
      }),
      ensureDocument('regions/southeast', {
        id: 'southeast',
        name: 'Southeast',
        code: 'SE',
        sortOrder: 4,
      }),
      ensureDocument('regions/northwest', {
        id: 'northwest',
        name: 'Northwest',
        code: 'NW',
        sortOrder: 5,
      }),
      ensureDocument('leaderboards/global', {
        individuals: [],
        religions: [],
        organizations: [],
      }),
      ensureDocument(
        'religionChats/seed-user/messages/welcome',
        { text: 'Welcome to religion chat!' },
      ),
      ensureDocument(
        'tempReligionChat/seed-user/messages/intro',
        { text: 'This is a temporary chat placeholder.' },
      ),
      ensureDocument(
        'confessionalSessions/seed-user/messages/first',
        { text: 'Sample confession message.' },
      ),
    ]);
    res.status(200).json({ message: 'Firestore seeded' });
  } catch (err: any) {
    logger.error('seedFirestore failed', err);
    res.status(500).json({ error: err.message || 'Failed to seed Firestore' });
  }
});


// export const onUserCreate = (functions as any).auth.user().onCreate(async (user: admin.auth.UserRecord) => {
//   const uid = user.uid;
//   try {
//     const docRef = admin.firestore().doc(`users/${uid}`);
//     const timestamp = admin.firestore.FieldValue.serverTimestamp();
//     const profile = {
//       uid: user.uid,
//       email: user.email ?? "",
//       emailVerified: !!user.emailVerified,
//       displayName: user.displayName || "",
//       username: "",
//       region: "",
//       createdAt: timestamp,
//       lastActive: timestamp,
//       lastFreeAsk: timestamp,
//       lastFreeSkip: timestamp,
//       onboardingComplete: false,
//       religion: "SpiritGuide",
//       tokens: 0,
//       tokenCount: 0,
//       skipTokensUsed: 0,
//       individualPoints: 0,
//       isSubscribed: false,
//       nightModeEnabled: false,
//       preferredName: user.displayName || "",
//       pronouns: "",
//       avatarURL: "",
//       profileComplete: false,
//       profileSchemaVersion: CURRENT_PROFILE_SCHEMA,
//       challengeStreak: { count: 0, lastCompletedDate: null },
//       dailyChallengeCount: 0,
//       dailySkipCount: 0,
//       lastChallengeLoadDate: null,
//       lastSkipDate: null,
//       organization: null,
//       organizationId: null,
//       religionPrefix: "",
//     };
//
//     logger.info("onUserCreate profile", profile);
//
//     await docRef.set(profile, { merge: true });
//     const subscriptionRef = admin.firestore().doc(`subscriptions/${uid}`);
//     await subscriptionRef.set({
//       isSubscribed: false,
//       plan: null,
//       startDate: null,
//       expiryDate: null,
//       createdAt: timestamp,
//     });
//   } catch (err) {
//     logger.error(`onUserCreate failed for ${uid}`, err);
//   }
// });

export const backfillUserProfiles = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    let processed = 0;
    let updated = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const batchSize = 500;

    const isMissing = (v: any) => v === undefined || v === null;
    const isMissingString = (v: any) =>
      isMissing(v) || (typeof v === "string" && v.trim() === "");

    while (true) {
      let query = db
        .collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snap = await query.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, any>;
        const updates: Record<string, any> = {};

        const serverTs = admin.firestore.FieldValue.serverTimestamp() as any;

        if (isMissingString(data.email)) updates.email = "";
        if (typeof data.isSubscribed !== "boolean") updates.isSubscribed = false;
        if (isMissing(data.createdAt)) updates.createdAt = serverTs;
        if (!data.challengeStreak)
          updates.challengeStreak = { count: 0, lastCompletedDate: null };
        if (typeof data.dailyChallengeCount !== "number")
          updates.dailyChallengeCount = 0;
        if (typeof data.dailySkipCount !== "number")
          updates.dailySkipCount = 0;
        if (!("lastChallengeLoadDate" in data)) updates.lastChallengeLoadDate = null;
        if (!("lastSkipDate" in data)) updates.lastSkipDate = null;
        if (typeof data.skipTokensUsed !== "number") updates.skipTokensUsed = 0;
        if (typeof data.nightModeEnabled !== "boolean")
          updates.nightModeEnabled = false;
        updates.profileComplete = true;
        if (typeof data.profileSchemaVersion !== "number")
          updates.profileSchemaVersion = 1;
        if (isMissing(data.lastActive)) updates.lastActive = serverTs;
        if (isMissingString(data.religionPrefix)) updates.religionPrefix = "";
        if (isMissingString((data as any).organizationId))
          (updates as any).organizationId = null;
        if (isMissingString(data.preferredName)) updates.preferredName = "";
        if (isMissingString(data.pronouns)) updates.pronouns = "";
        if (isMissingString(data.avatarURL)) updates.avatarURL = "";
        if (isMissingString(data.displayName)) updates.displayName = "";
        if (isMissingString(data.username)) updates.username = "";
        if (isMissingString(data.region)) updates.region = "";
        if (isMissingString(data.religion)) updates.religion = "SpiritGuide";
        if (typeof data.tokens !== "number") updates.tokens = 0;
        if (typeof data.individualPoints !== "number") updates.individualPoints = 0;
        updates.onboardingComplete = true;
        if (!("organization" in data)) (updates as any).organization = null;

        if (Object.keys(updates).length) {
          logger.info(`Backfilling user ${doc.id}`, updates);
          await doc.ref.set(updates, { merge: true });
          updated++;
        } else {
          logger.info(`No updates needed for ${doc.id}`);
        }

        processed++;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    logger.info(`Backfill complete`, { processed, updated });
    return { processed, updated };
  });

export const updateUserProfileCallable = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    const uid: string | undefined = data?.uid || context.auth.uid;
    const fields = data?.fields || {};

    if (!uid) {
      throw new functions.https.HttpsError("invalid-argument", "Missing uid");
    }
    if (typeof fields !== "object" || Array.isArray(fields)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "fields must be an object",
      );
    }

    const docRef = admin.firestore().collection("users").doc(uid);
    logger.info(`updateUserProfileCallable`, { uid, fields });
    try {
      await docRef.set(fields, { merge: true });
      return { success: true };
    } catch (err: any) {
      logger.error(`updateUserProfileCallable failed for ${uid}`, err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Update failed",
      );
    }
  });

export const completeSignupAndProfile = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
      );
    }

    const uid: string | undefined = data?.uid;
    const rawProfile = data?.profile || {};

    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "UID mismatch",
      );
    }

    const profile = validateSignupProfile(rawProfile);

    const existing = await admin
      .firestore()
      .collection("users")
      .where("username", "==", profile.username)
      .limit(1)
      .get();
    if (!existing.empty && existing.docs[0].id !== uid) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Username already taken",
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const defaultProfile = {
      uid,
      email: profile.email,
      emailVerified: false,
      displayName: profile.displayName || profile.username,
      username: profile.username,
      region: profile.region || "",
      createdAt: timestamp,
      lastActive: timestamp,
      lastFreeAsk: timestamp,
      lastFreeSkip: timestamp,
      onboardingComplete: true,
      religion: profile.religion,
      tokens: 0,
      skipTokensUsed: 0,
      individualPoints: 0,
      isSubscribed: false,
      nightModeEnabled: false,
      preferredName: profile.preferredName,
      pronouns: profile.pronouns,
      avatarURL: profile.avatarURL,
      profileComplete: true,
      profileSchemaVersion: CURRENT_PROFILE_SCHEMA,
      challengeStreak: { count: 0, lastCompletedDate: null },
      dailyChallengeCount: 0,
      dailySkipCount: 0,
      lastChallengeLoadDate: null,
      lastSkipDate: null,
      organization: profile.organization ?? null,
      organizationId: null,
      religionPrefix: "",
    };

    const docRef = admin.firestore().collection("users").doc(uid);
    logger.info(`completeSignupAndProfile`, { uid, profile: defaultProfile });
    try {
      await docRef.set(defaultProfile, { merge: true });
      return { success: true };
    } catch (err: any) {
      logger.error(`completeSignupAndProfile failed for ${uid}`, err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Profile creation failed",
      );
    }
  });

export const createStripeSetupIntent = functions.https.onRequest(
  withCors(async (req: Request, res: Response) => {
    logger.info('createStripeSetupIntent called', { body: req.body });

    logger.debug('Verifying auth token');
    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
      logger.debug('Auth token verified', { uid: authData.uid });
    } catch (err) {
      logTokenVerificationError('createStripeSetupIntent', extractAuthToken(req), err);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = req.body || {};
    const uid = authData.uid;

    logger.debug('Checking Stripe secret configuration');
    const stripeSecret = functions.config().stripe?.secret;
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    logger.debug('Retrieving or creating Stripe customer');
    let customerId: string;
    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      customerId = (snap.data() as any)?.stripeCustomerId;

      if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
          email: userRecord.email ?? undefined,
          metadata: { uid },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        logger.info('Stripe customer created', { uid, customerId });
      } else {
        logger.info('Stripe customer reused', { uid, customerId });
      }
    } catch (err) {
      logger.error('Failed to retrieve or create Stripe customer', err);
      res.status(500).json({ error: 'Unable to create customer' });
      return;
    }

    logger.debug('Creating Stripe ephemeral key');
    let ephemeralKey: Stripe.EphemeralKey;
    try {
      ephemeralKey = await stripeClient.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );
    } catch (err: any) {
      logger.error('Stripe ephemeralKey creation failed', err);
      res.status(500).json({ error: err?.message || 'Ephemeral key failed' });
      return;
    }

    let intent: Stripe.SetupIntent | Stripe.PaymentIntent;
    const mode = data.mode || 'setup';
    const currency = typeof data.currency === 'string' ? data.currency : 'usd';

    logger.debug('Creating Stripe intent', { mode });
    if (mode === 'payment' || mode === 'subscription' || mode === 'donation') {
      try {
        const amount = Number(data.amount);
        if (!amount || isNaN(amount)) {
          res.status(400).json({ error: 'amount required for payment' });
          return;
        }
        const eventType = data.eventType || data.type || mode;
        const metadata: Record<string, string> = {
          uid,
          eventType,
          type: eventType,
          ...(data.tokenAmount ? { tokenAmount: String(data.tokenAmount) } : {}),
        };
        intent = await stripeClient.paymentIntents.create({
          amount,
          currency,
          customer: customerId,
          metadata,
          automatic_payment_methods: { enabled: true },
        });
      } catch (err: any) {
        logger.error('Stripe PaymentIntent creation failed', err);
        res.status(500).json({ error: err?.message || 'PaymentIntent creation failed' });
        return;
      }
    } else {
      logger.debug('Creating Stripe SetupIntent for customer', { customerId });
      try {
        const eventType = data.eventType || data.type;
        const metadata: Record<string, string> = { uid };
        if (eventType) {
          metadata.eventType = eventType;
          metadata.type = eventType; // backward compatibility
          if (eventType === 'token' && data.tokenAmount) {
            metadata.tokenAmount = String(data.tokenAmount);
          }
        }
        intent = await stripeClient.setupIntents.create({
          customer: customerId,
          metadata,
          automatic_payment_methods: { enabled: true },
        });
        logger.info('SetupIntent created', { intentId: intent.id });
      } catch (err: any) {
        logger.error('Stripe SetupIntent failed', err);
        res.status(500).json({ error: err?.message || 'Stripe SetupIntent failed' });
        return;
      }
    }

    logger.info('Stripe intent created', { uid, mode, intentId: intent.id });

    res.status(200).json({
      client_secret: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId,
    });
  })
);

export const finalizePaymentIntent = functions.https.onRequest(
  withCors(async (req: Request, res: Response) => {
    logger.info('finalizePaymentIntent called', { body: req.body });

    let authData: { uid: string; token: string };
    try {
      authData = await verifyAuth(req);
    } catch (err) {
      logTokenVerificationError('finalizePaymentIntent', extractAuthToken(req), err);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { paymentIntentId, mode, tokenAmount } = req.body || {};

    if (typeof paymentIntentId !== 'string' || !paymentIntentId.trim()) {
      res.status(400).json({ error: 'paymentIntentId required' });
      return;
    }

    if (!mode || !['payment', 'subscription', 'donation'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    if (mode === 'payment' && (typeof tokenAmount !== 'number' || tokenAmount <= 0)) {
      res.status(400).json({ error: 'tokenAmount required for payment mode' });
      return;
    }

    const stripeSecret = functions.config().stripe?.secret;
    if (!stripeSecret) {
      logger.error('Stripe secret not configured');
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    try {
      const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        res.status(400).json({ error: 'Payment not completed' });
        return;
      }

      const uid = authData.uid;

      if (mode === 'subscription') {
        await db.doc(`users/${uid}`).set(
          {
            isSubscribed: true,
            subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        console.log(`User ${uid} subscribed`);
        await db.doc(`users/${uid}/transactions/${paymentIntentId}`).set(
          {
            amount: intent.amount,
            currency: intent.currency,
            stripePaymentIntentId: paymentIntentId,
            paymentMethod: intent.payment_method_types?.[0] || 'unknown',
            status: intent.status,
            type: 'subscription',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        console.log('Transaction logged');
      } else if (mode === 'payment') {
        await addTokens(uid, tokenAmount);
        console.log(`Added ${tokenAmount} tokens to ${uid}`);
      } else if (mode === 'donation') {
        await db.doc(`users/${uid}/donations/${paymentIntentId}`).set({
          amount: intent.amount,
          currency: intent.currency,
          created: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Donation logged for ${uid}`);
      }

      await db.doc(`users/${uid}/payments/${paymentIntentId}`).set(
        {
          mode,
          status: 'completed',
          created: admin.firestore.FieldValue.serverTimestamp(),
          amount: intent.amount,
        },
        { merge: true }
      );

      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error('finalizePaymentIntent failed', err);
      res.status(500).json({ error: err?.message || 'Failed to finalize payment' });
    }
  })
);

export const createTokenPurchaseSheet = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const amount = Number(data?.amount);
    const uid = data?.uid;

    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }

    if (![5, 20].includes(amount)) {
      throw new functions.https.HttpsError('invalid-argument', 'amount must be 5 or 20');
    }

    const stripeSecret = functions.config().stripe?.secret || STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      throw new functions.https.HttpsError('internal', 'Stripe not configured');
    }

    const publishableKey =
      functions.config().stripe?.publishable || STRIPE_PUBLISHABLE_KEY;

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    let customerId: string;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    customerId = (snap.data() as any)?.stripeCustomerId;

    if (!customerId) {
      const userRecord = await auth.getUser(uid);
      const customer = await stripeClient.customers.create({
        email: userRecord.email ?? undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const ephemeralKey = await stripeClient.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    const intent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        uid,
        tokens: amount,
        type: 'token',
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      paymentIntent: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey,
    };
  }
);

export const createSubscriptionSession = functions.https.onCall(
  async (data: any, context: any) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const uid: string | undefined = data?.uid;
    if (!uid || uid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }

    const stripeSecret = functions.config().stripe?.secret || STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      throw new functions.https.HttpsError('internal', 'Stripe not configured');
    }

    const subscriptionPriceId =
      functions.config().stripe?.sub_price_id || process.env.STRIPE_SUB_PRICE_ID;
    if (!subscriptionPriceId) {
      throw new functions.https.HttpsError('internal', 'Subscription price not configured');
    }

    const stripeClient = new Stripe(stripeSecret, { apiVersion: '2023-10-16' } as any);

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    let customerId = (snap.data() as any)?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const userRecord = await auth.getUser(uid);
      const customer = await stripeClient.customers.create({
        email: userRecord.email ?? undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: subscriptionPriceId, quantity: 1 }],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      client_reference_id: uid,
      customer: customerId,
      metadata: { uid, type: 'subscription' },
    });

    return { sessionId: session.id, url: session.url };
  }
);

export { onCompletedChallengeCreate } from './firestoreArchitecture';
export { handleStripeWebhookV2 } from './stripeWebhooks';
