import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { auth, db } from '@core/firebase';
import { createGeminiModel, fetchReligionContext } from '@core/geminiUtils';
import { updateStreakAndXPInternal, logTokenVerificationError } from './utils';

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
        points: admin.firestore.FieldValue.increment(points),
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
    logger.error("generateChallenge error", err);
    res.status(500).json({ error: err.message || "Failed" });
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

    let last = histSnap.docs[histSnap.docs.length - 1];
    let snap = await historyRef
      .orderBy("timestamp", "desc")
      .startAfter(last)
      .limit(20)
      .get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      last = snap.docs[snap.docs.length - 1];
      snap = await historyRef
        .orderBy("timestamp", "desc")
        .startAfter(last)
        .limit(20)
        .get();
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

    let last = histSnap.docs[histSnap.docs.length - 1];
    let snap = await historyRef
      .orderBy("timestamp", "desc")
      .startAfter(last)
      .limit(20)
      .get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      last = snap.docs[snap.docs.length - 1];
      snap = await historyRef
        .orderBy("timestamp", "desc")
        .startAfter(last)
        .limit(20)
        .get();
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
