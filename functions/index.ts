import * as functions from "firebase-functions/v1";
import { auth, db } from "./firebase";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import { RawBodyRequest } from "./types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as logger from "firebase-functions/logger";
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
    errorCode: err?.code,
    message: err?.message,
  });
}

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

export const incrementReligionPoints = functions
  .region("us-central1")
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

        const ref = db.collection("religions").doc(religion);
        await db.runTransaction(async (t: FirebaseFirestore.Transaction) => {
          const snap = await t.get(ref);
          const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
          t.set(ref, { totalPoints: current + points }, { merge: true });
        });

        res.status(200).send({ message: "Points updated" });
      } catch (err: any) {
        logError("incrementReligionPoints", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
      }
    })
  );

export const awardPointsToUser = functions
  .region("us-central1")
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
        const religionId = userData.religion;
        const organizationId = userData.organizationId;

        await db.runTransaction(async (t) => {
          if (religionId) {
            const ref = db.doc(`religions/${religionId}`);
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: religionId, totalPoints: current + points }, { merge: true });
          }
          if (organizationId) {
            const ref = db.doc(`organizations/${organizationId}`);
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { name: organizationId, totalPoints: current + points }, { merge: true });
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
  .region("us-central1")
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
  .region("us-central1")
  .https.onRequest(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { prompt = "", days = 1, basePoints = 10 } = req.body || {};
  if (typeof days !== "number" || days < 1 || days > 7) {
    res.status(400).json({ error: "days must be between 1 and 7" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRef = db.collection("users").doc(uid);
    const challengeRef = db.doc(`users/${uid}/activeChallenge/current`);

    const basePrompt =
      prompt.trim() ||
      `Generate a ${days}-day spiritual challenge. Give concise instructions for each day.`;

    let text = "";
    try {
      const model = createGeminiModel();
      const chat = await model.startChat({ history: [] });
      const result = await chat.sendMessage(basePrompt);
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
  .region("us-central1")
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

      const basePoints = data.basePoints || 10;
      let points = basePoints;
      if (isComplete && doubleBonusEligible && completed.length === totalDays) {
        bonus = basePoints * totalDays;
        points += bonus;
      }

      t.update(userRef, {
        individualPoints: admin.firestore.FieldValue.increment(points),
      });
    });

    await updateStreakAndXPInternal(uid, "challenge");

    res.status(200).json({ message: "Day completed", bonusAwarded: bonus });
  } catch (err: any) {
    logger.error("completeChallengeDay error", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
});

export const askGeminiSimple = functions
  .region("us-central1")
  .https.onRequest(async (req: Request, res: Response) => {
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

export const askGeminiV2 = functions
  .region("us-central1")
  .https.onRequest(async (req: Request, res: Response) => {
  console.log("🔍 Headers received:", req.headers);
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  logger.debug(`Token prefix: ${idToken ? idToken.slice(0, 10) : "none"}`);
  if (!idToken) {
    logger.error("No ID token provided");
    res.status(401).json({ error: "Unauthorized – No ID token provided" });
    return;
  }

  const { prompt = "", history = [] } = req.body || {};
  logger.info(`📩 askGeminiV2 prompt length: ${prompt.length}`);
  logger.info(`📜 askGeminiV2 history length: ${(history as any[]).length}`);

  try {
    const decoded = await auth.verifyIdToken(idToken);
    logger.info(`✅ askGeminiV2 user: ${decoded.uid}`);
    console.log("📛 Decoded userId from token:", decoded.uid);
    logger.debug(`Decoded UID: ${decoded.uid}`);

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
      logger.info("💬 Gemini response:", text);
    } catch (gemErr) {
      logger.error("Gemini V2 request failed", gemErr);
      res.status(500).json({ error: "Gemini request failed" });
      return;
    }

    try {
      const subSnap = await db.collection("subscriptions").doc(decoded.uid).get();
      const subscribed = subSnap.exists && subSnap.data()?.active;
      const base = subscribed ? "religionChats" : "tempReligionChat";
      const col = db.collection(base).doc(decoded.uid).collection("messages");
      console.log("🧠 Writing to Firestore path:", `${base}/${decoded.uid}/messages`);
      await col.add({ role: "user", text: prompt, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      await col.add({ role: "assistant", text, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      logger.info(`💾 Saved chat messages to ${base}`);
    } catch (saveErr) {
      logger.error("Failed to save assistant message", saveErr);
    }

    res.status(200).json({ response: text });
  } catch (err: any) {
    logTokenVerificationError('askGeminiV2', idToken, err);
    res.status(401).json({ error: "Unauthorized – Invalid ID token" });
  }
});

export const generateChallenge = functions
  .region("us-central1")
  .https.onRequest(async (req: Request, res: Response) => {
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
    logTokenVerificationError('generateChallenge', idToken, err);
    if (err.code === "auth/argument-error") {
      res.status(401).json({
        error: "Unauthorized — Gus bug cast an invalid token spell.",
      });
      return;
    }
    res.status(500).json({ error: "Gemini failed" });
  }
});

export const generateDailyChallenge = functions
  .region("us-central1")
  .https.onRequest(async (req: Request, res: Response) => {
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

export const skipDailyChallenge = functions
  .region("us-central1")
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
  .region("us-central1")
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("📦 startSubscriptionCheckout payload", req.body);
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
    if (authData.uid !== userId) {
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
    logTokenVerificationError('startSubscriptionCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

// TODO: startOneTimeTokenCheckout is unused in the current frontend. Consider
// removing or wiring it up in a future release.
export const startOneTimeTokenCheckout = functions
  .region("us-central1")
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
    logTokenVerificationError('startOneTimeTokenCheckout', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

export const startDonationCheckout = functions
  .region("us-central1")
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
  .region("us-central1")
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
    logTokenVerificationError('startCheckoutSession', authData.token, err);
    res
      .status(500)
      .json({ error: (err as any)?.message || "Failed to start checkout" });
  }
}));

export const createStripeCheckout = functions
  .region("us-central1")
  .https.onRequest(withCors(async (req: Request, res: Response) => {
  logger.info("🛒 createStripeCheckout payload", req.body);
  const { uid, email, priceId, type, quantity, returnUrl } = req.body || {};

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

  let finalPriceId: string | undefined = priceId;
  if (type === "tokens" && !priceId) {
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
    if (quantity) {
      metadata.quantity = String(quantity);
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

export const handleStripeWebhookV2 = functions
  .region("us-central1")
  .https.onRequest(async (req: RawBodyRequest, res: Response) => {
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

export const updateStreakAndXP = functions
  .region("us-central1")
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

async function ensureDocument(
  path: string,
  data: Record<string, any>,
) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(data);
  }
}

export const seedFirestore = functions
  .region("us-central1")
  .https.onRequest(async (_req, res) => {
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
      ensureDocument('religions/dummy', { name: 'Dummy Religion' }),
      ensureDocument('organizations/dummy', { name: 'Dummy Org' }),
      ensureDocument('regions/SW', { name: 'Southwest', code: 'SW', sortOrder: 1 }),
      ensureDocument('regions/NE', { name: 'Northeast', code: 'NE', sortOrder: 2 }),
      ensureDocument('regions/MW', { name: 'Midwest', code: 'MW', sortOrder: 3 }),
      ensureDocument('regions/SE', { name: 'Southeast', code: 'SE', sortOrder: 4 }),
      ensureDocument('regions/NW', { name: 'Northwest', code: 'NW', sortOrder: 5 }),
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

export const createSubscriptionOnSignup = functions
  .auth
  .user()
  .onCreate(async (user: admin.auth.UserRecord) => {
    const subRef = db.collection("subscriptions").doc(user.uid);
    const snap = await subRef.get();
    if (!snap.exists) {
      await subRef.set({
        active: false,
        tier: "free",
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
      });
    }
  });
