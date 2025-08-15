import * as functions from 'firebase-functions/v1';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '../firebase';
import { createGeminiModel, fetchReligionContext } from '../geminiUtils';
import { logTokenVerificationError } from './utils';

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
