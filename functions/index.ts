import { onRequest } from "firebase-functions/v2/https";
import { auth, db } from "./firebase";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const incrementReligionPoints = onRequest(async (req, res) => {
  const raw = req.headers.authorization || "";
  const idToken = raw.replace(/Bearer\s+/i, "").trim();
  if (!idToken) {
    res.status(401).send("Missing token");
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
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
    console.error("🔥 Backend error:", err.message);
    if (err.code === "auth/argument-error") {
      res.status(401).send("Invalid token");
    } else {
      res.status(500).send("Internal error");
    }
  }
});

export const completeChallenge = onRequest(async (_req, res) => {
  res.status(200).send({ message: "✅ completeChallenge function is live" });
});

export const askGeminiV2 = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  const { prompt = "", history = [] } = req.body || {};

  if (!idToken) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const userData = snap.exists ? snap.data() : {};
    const recent: string[] = Array.isArray(userData?.recentChallenges)
      ? userData!.recentChallenges
      : [];

    const avoid = recent
      .map((c, i) => `#${i + 1}: ${c}`)
      .join("\n");

    const fullPrompt = `\nYou are a spiritual guide helping users grow in faith.\n\nDo NOT repeat or closely resemble any of the following recent challenges:\n${avoid}\n\nNow generate a new, unique, and creative spiritual challenge inspired by Christian teachings.\nMake it practical, soul-stirring, and concise.\nRespond ONLY with the new challenge text.`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const chat = await model.startChat({
      history: (history as any[]).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(fullPrompt);
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
    console.error("🔥 Gemini Error:", err.message);
    if (err.code === "auth/argument-error") {
      res.status(401).json({ error: "Invalid token" });
    } else {
      res.status(500).json({ error: "Gemini failed" });
    }
  }
});
