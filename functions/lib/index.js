"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeAllCounts = exports.userCountsOnWrite = exports.cleanLegacySubscriptionFields = exports.handleStripeWebhookV2 = exports.onCompletedChallengeCreate = exports.createSubscriptionSession = exports.createTokenPurchaseSheet = exports.finalizePaymentIntent = exports.createStripeSetupIntent = exports.postSignup = exports.updateUserProfile = exports.backfillUserProfiles = exports.seedFirestore = exports.getUserProfile = exports.updateStreakAndXP = exports.createStripeCheckout = exports.startCheckoutSession = exports.startDonationCheckout = exports.createStripeSubscriptionIntent = exports.createCheckoutSession = exports.startTokenCheckout = exports.startOneTimeTokenCheckout = exports.startSubscriptionCheckout = exports.skipDailyChallenge = exports.generateDailyChallenge = exports.generateChallenge = exports.askGeminiV2 = exports.confessionalAI = exports.askGeminiSimple = exports.completeChallengeDay = exports.createMultiDayChallenge = exports.completeChallenge = exports.awardPointsToUser = exports.incrementReligionPoints = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const dotenv = __importStar(require("dotenv"));
const logger = __importStar(require("firebase-functions/logger"));
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
const generative_ai_1 = require("@google/generative-ai");
const geminiUtils_1 = require("./geminiUtils");
const helpers_1 = require("./helpers");
const optionalAuth_1 = require("./middleware/optionalAuth");
function logTokenVerificationError(context, token, err) {
    logger.error(`${context} token verification failed`, {
        tokenPrefix: token ? token.slice(0, 10) : "none",
        errorCode: err?.code,
        message: err?.message,
    });
}
dotenv.config();
dotenv.config({ path: ".env.functions" });
const GEMINI_API_KEY = functions.config().gemini?.key || "";
if (!GEMINI_API_KEY) {
    logger.warn("Gemini API key not found in functions config. Set with 'firebase functions:config:set gemini.key=YOUR_KEY'");
}
else {
    logger.info("✅ GEMINI_API_KEY loaded from functions config");
}
const LOGGING_MODE = process.env.LOGGING_MODE || "gusbug";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
const APP_BASE_URL = process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    "https://onevine.app";
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL ||
    `${APP_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";
function cleanPriceId(raw) {
    return raw.split('#')[0].trim();
}
const STRIPE_20_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_20_TOKEN_PRICE_ID || '');
const STRIPE_50_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_50_TOKEN_PRICE_ID || '');
const STRIPE_100_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_100_TOKEN_PRICE_ID || '');
function getTokensFromPriceId(priceId) {
    if (priceId === STRIPE_20_TOKEN_PRICE_ID)
        return 20;
    if (priceId === STRIPE_50_TOKEN_PRICE_ID)
        return 50;
    if (priceId === STRIPE_100_TOKEN_PRICE_ID)
        return 100;
    return null;
}
const CURRENT_PROFILE_SCHEMA = 1;
function validateSignupProfile(profile) {
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
    const sanitized = {};
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
        }
        catch {
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
        if (profile.organization !== null &&
            typeof profile.organization !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'organization must be a string or null');
        }
        sanitized.organization = profile.organization ?? null;
    }
    return sanitized;
}
if (!process.env.STRIPE_SUB_PRICE_ID) {
    logger.warn("⚠️ Missing STRIPE_SUB_PRICE_ID in .env");
}
if (!STRIPE_SECRET_KEY) {
    logger.error("❌ STRIPE_SECRET_KEY missing. Set this in your environment.");
}
else {
    logger.info("✅ Stripe key loaded");
}
const stripe = new stripe_1.default(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});
async function addTokens(uid, amount) {
    const userRef = db.collection("users").doc(uid);
    await db.runTransaction(async (t) => {
        const snap = await t.get(userRef);
        const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
        t.set(userRef, {
            tokens: current + amount,
            lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
}
async function deductTokens(uid, amount) {
    const userRef = db.collection("users").doc(uid);
    try {
        await db.runTransaction(async (t) => {
            const snap = await t.get(userRef);
            const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
            if (current < amount) {
                throw new Error("INSUFFICIENT_TOKENS");
            }
            t.set(userRef, {
                tokens: current - amount,
                lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        return true;
    }
    catch (err) {
        if (err.message === "INSUFFICIENT_TOKENS") {
            return false;
        }
        throw err;
    }
}
async function updateStreakAndXPInternal(uid, type) {
    const baseRef = db.collection("users").doc(uid);
    const ref = type === "journal"
        ? db.doc(`users/${uid}/journalStreak/current`)
        : baseRef;
    await db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const data = snap.exists ? snap.data() || {} : {};
        const now = admin.firestore.Timestamp.now();
        const last = data.lastCheckIn;
        const streak = data.streakCount || 0;
        const xp = data.xpPoints || 0;
        const longest = data.longestStreak || 0;
        let newStreak = 1;
        if (last) {
            const diffMs = now.toMillis() - last.toMillis();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays < 1) {
                newStreak = streak; // same day
            }
            else if (diffDays < 2) {
                newStreak = streak + 1;
            }
        }
        const xpEarned = 10;
        t.set(ref, {
            lastCheckIn: now,
            streakCount: newStreak,
            xpPoints: xp + xpEarned,
            longestStreak: Math.max(longest, newStreak),
        }, { merge: true });
    });
}
async function findUidByCustomer(customerId) {
    if (!customerId)
        return null;
    const snap = await db
        .collection("users")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    return snap.docs[0].id;
}
exports.incrementReligionPoints = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    try {
        const { uid } = await (0, helpers_1.verifyIdToken)(req);
        const { religion, points } = req.body;
        if (typeof religion !== "string" ||
            typeof points !== "number" ||
            points <= 0 ||
            points > 100) {
            res.status(400).send("Invalid input.");
            return;
        }
        const ref = db.collection("religion").doc(religion);
        logger.info("🛠 Updating religion doc with merge", { religion });
        await db.runTransaction(async (t) => {
            const snap = await t.get(ref);
            const current = snap.exists ? (snap.data()?.totalPoints ?? 0) : 0;
            t.set(ref, { totalPoints: current + points }, { merge: true });
        });
        logger.info("✅ Religion updated", { religion });
        res.status(200).send({ message: "Points updated" });
    }
    catch (err) {
        (0, helpers_1.logError)("incrementReligionPoints", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
    }
}));
exports.awardPointsToUser = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    try {
        const { uid } = await (0, helpers_1.verifyIdToken)(req);
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
    }
    catch (err) {
        (0, helpers_1.logError)("awardPointsToUser", err);
        const code = err.message === "Unauthorized" ? 401 : 500;
        res.status(code).json({ error: err.message });
    }
}));
exports.completeChallenge = functions
    .https.onRequest(async (req, res) => {
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
    }
    catch (err) {
        logTokenVerificationError('completeChallenge', token, err);
        res.status(401).json({
            error: "Unauthorized — Gus bug cast an invalid token spell.",
        });
        return;
    }
});
exports.createMultiDayChallenge = functions
    .https.onRequest(async (req, res) => {
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
        const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
        const basePrompt = prompt.trim() ||
            `Generate a ${days}-day spiritual challenge. Give concise instructions for each day.`;
        const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}`;
        let text = "";
        try {
            const model = (0, geminiUtils_1.createGeminiModel)();
            const chat = await model.startChat({ history: [] });
            const result = await chat.sendMessage(fullPrompt);
            text = result?.response?.text?.() || "";
        }
        catch (err) {
            logger.error("Gemini createMultiDayChallenge failed", err);
            res.status(500).json({ error: "Gemini request failed" });
            return;
        }
        text = text.trim();
        if (!text) {
            res.status(500).json({ error: "Empty challenge" });
            return;
        }
        await challengeRef.set({
            challengeText: text,
            totalDays: days,
            currentDay: 1,
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            lastCompleted: null,
            completedDays: [],
            isComplete: false,
            basePoints,
            doubleBonusEligible: true,
        }, { merge: true });
        await userRef.set({
            lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
            lastChallengeText: text,
        }, { merge: true });
        res.status(200).json({ challengeText: text });
    }
    catch (err) {
        logger.error("createMultiDayChallenge error", err);
        res.status(500).json({ error: err.message || "Failed" });
    }
});
exports.completeChallengeDay = functions
    .https.onRequest(async (req, res) => {
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
            const last = data.lastCompleted || null;
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
            const completed = Array.isArray(data.completedDays)
                ? data.completedDays
                : [];
            if (completed.includes(currentDay)) {
                throw new Error("DAY_ALREADY_COMPLETED");
            }
            completed.push(currentDay);
            const newCurrent = currentDay + 1;
            const isComplete = newCurrent > totalDays;
            t.set(challengeRef, {
                completedDays: completed,
                currentDay: newCurrent,
                lastCompleted: now,
                isComplete,
                doubleBonusEligible,
            }, { merge: true });
            const logRef = challengeRef.collection("challengeLogs").doc();
            t.set(logRef, { day: currentDay, timestamp: now });
            const userSnap = await t.get(userRef);
            const userData = userSnap.exists ? userSnap.data() || {} : {};
            const relRef = userData.religionRef || (userData.religion ? db.doc(`religion/${userData.religion}`) : null);
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
    }
    catch (err) {
        logger.error("completeChallengeDay error", err);
        res.status(500).json({ error: err.message || "Failed" });
    }
});
exports.askGeminiSimple = functions
    .https.onRequest(async (req, res) => {
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
            const model = (0, geminiUtils_1.createGeminiModel)();
            const chat = await model.startChat({
                history: history.map((msg) => ({
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
                }
                catch { }
            }
            const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
            const system = promptPrefix || `As a ${aiVoice} within the ${name} tradition,`;
            const fullPrompt = `${system} respond to the following:\n"${prompt}"`;
            const result = await chat.sendMessage(fullPrompt);
            text = result?.response?.text?.() ?? "No response text returned.";
        }
        catch (gemErr) {
            console.error("Gemini request failed", gemErr);
            res.status(500).json({ error: "Gemini request failed" });
            return;
        }
        res.status(200).json({ response: text });
    }
    catch (err) {
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
exports.confessionalAI = functions
    .https.onRequest(async (req, res) => {
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { history = [], religion: religionId } = req.body || {};
    try {
        const decoded = await auth.verifyIdToken(idToken);
        logger.info(`✅ confessionalAI user: ${decoded.uid}`);
        const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
        const promptText = history
            .map((m) => `${m.role}: ${m.text}`)
            .join("\n");
        const system = `As a ${aiVoice} within the ${name} tradition, offer a brief compassionate response to the confession below.`;
        const model = (0, geminiUtils_1.createGeminiModel)();
        const chat = await model.startChat({ history: [] });
        const result = await chat.sendMessage(`${system}\n${promptText}`);
        const reply = result?.response?.text?.() || "";
        res.status(200).json({ reply });
    }
    catch (err) {
        logTokenVerificationError('confessionalAI', idToken, err);
        const isAuthErr = err.code === "auth/argument-error" || err.code === "auth/id-token-expired";
        const code = isAuthErr ? 401 : 500;
        res.status(code).json({ error: err.message || "Failed" });
    }
});
exports.askGeminiV2 = functions
    .https.onRequest(async (req, res) => {
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
        functions.logger.warn("Gemini API key not found in functions config");
        res.status(500).json({ error: "Gemini API key not configured" });
        return;
    }
    console.log("🔍 Incoming prompt", userInput);
    try {
        const decoded = await auth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.data() || {};
        const userReligion = userData.religion;
        let religionPrompt = "";
        let religionName = userReligion || "unknown";
        if (userReligion) {
            const relSnap = await db.collection("religion").doc(userReligion).get();
            if (relSnap.exists) {
                const data = relSnap.data() || {};
                religionPrompt = data.prompt || "";
                religionName = data.name || userReligion;
            }
        }
        const finalPrompt = `${religionPrompt}\n${userInput}`;
        functions.logger.info(`askGeminiV2 religion: ${religionName}`);
        functions.logger.info(`askGeminiV2 full prompt: ${finalPrompt}`);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
        const chat = await model.startChat({
            history: history.map((msg) => ({
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
    }
    catch (err) {
        console.error("askGeminiV2 request failed", err);
        res.status(500).json({ error: "Gemini request failed" });
    }
});
exports.generateChallenge = functions
    .https.onRequest(async (req, res) => {
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
        const recent = Array.isArray(userData?.recentChallenges)
            ? userData.recentChallenges
            : [];
        const avoid = recent
            .map((c, i) => `#${i + 1}: ${c}`)
            .join("\n");
        const randomizer = `Seed:${seed}`;
        const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
        const basePrompt = prompt.trim() ||
            `Generate a new, unique, and creative spiritual challenge.`;
        const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n\nDo NOT repeat or closely resemble any of the following recent challenges:\n${avoid}\n\nRespond ONLY with the new challenge text.`;
        let text = "";
        try {
            const model = (0, geminiUtils_1.createGeminiModel)();
            const chat = await model.startChat({
                history: history.map((msg) => ({
                    role: msg.role,
                    parts: [{ text: msg.text }],
                })),
            });
            const result = await chat.sendMessage(`${fullPrompt}\n${randomizer}`);
            text = result?.response?.text?.() ?? "No response text returned.";
        }
        catch (gemErr) {
            console.error("Gemini generateChallenge failed", gemErr);
            res.status(500).json({ error: "Gemini request failed" });
            return;
        }
        const updated = [...recent.slice(-4), text];
        await userRef.set({
            lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
            lastChallengeText: text,
            recentChallenges: updated,
            dailyChallenge: text,
        }, { merge: true });
        res.status(200).json({ response: text });
    }
    catch (err) {
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
exports.generateDailyChallenge = functions
    .https.onRequest(async (req, res) => {
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
        const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
        const basePrompt = prompt.trim() ||
            "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
        const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n${avoidList}\nReturn only the challenge.`;
        logger.info("📝 Gemini prompt:", fullPrompt);
        let text = "";
        try {
            const model = (0, geminiUtils_1.createGeminiModel)();
            const chat = await model.startChat({ history: [] });
            const result = await chat.sendMessage(fullPrompt);
            text = result?.response?.text?.() || "";
        }
        catch (gemErr) {
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
                const model = (0, geminiUtils_1.createGeminiModel)();
                const chat = await model.startChat({ history: [] });
                const result = await chat.sendMessage(`${fullPrompt}\nEnsure it is different.`);
                text = result?.response?.text?.() || text;
                text = text.trim();
            }
            catch (retryErr) {
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
        await userRef.set({
            lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
            lastChallengeText: text,
            dailyChallenge: text,
        }, { merge: true });
        res.status(200).json({ response: text });
    }
    catch (err) {
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
exports.skipDailyChallenge = functions
    .https.onRequest(async (req, res) => {
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
            t.set(userRef, {
                tokens: tokens - cost,
                skipCountThisWeek: newSkipCount + 1,
                skipWeekStart: weekStart.toISOString(),
                lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
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
        const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
        const basePrompt = prompt.trim() ||
            "Generate a spiritually meaningful daily challenge that is unique, short, actionable, and not similar to these:";
        const fullPrompt = `As a ${aiVoice} within the ${name} tradition, ${basePrompt}\n${avoidList}\nReturn only the challenge.`;
        let text = "";
        try {
            const model = (0, geminiUtils_1.createGeminiModel)();
            const chat = await model.startChat({ history: [] });
            const result = await chat.sendMessage(fullPrompt);
            text = result?.response?.text?.() || "";
        }
        catch (gemErr) {
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
        await userRef.set({
            lastChallenge: admin.firestore.FieldValue.serverTimestamp(),
            lastChallengeText: text,
            dailyChallenge: text,
        }, { merge: true });
        res.status(200).json({ response: text, cost });
    }
    catch (err) {
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
exports.startSubscriptionCheckout = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info("📦 startSubscriptionCheckout payload", req.body);
    logger.info("🔐 Stripe Secret:", STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing");
    const { uid, priceId } = req.body || {};
    if (!uid || !priceId) {
        logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
        res.status(400).json({ error: "Missing uid or priceId" });
        return;
    }
    const cleanId = cleanPriceId(priceId);
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
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
    }
    catch (err) {
        logTokenVerificationError('startSubscriptionCheckout', authData.token, err);
        res
            .status(500)
            .json({ error: err?.message || "Failed to start checkout" });
    }
}));
// TODO: startOneTimeTokenCheckout is unused in the current frontend. Consider
// removing or wiring it up in a future release.
exports.startOneTimeTokenCheckout = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info("📦 startOneTimeTokenCheckout payload", req.body);
    logger.info("🔐 Stripe Secret:", STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing");
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
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
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
        const metadata = { uid: userId, type: "tokens" };
        if (tokens)
            metadata.tokens = String(tokens);
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
    }
    catch (err) {
        logTokenVerificationError('startOneTimeTokenCheckout', authData.token, err);
        res
            .status(500)
            .json({ error: err?.message || "Failed to start checkout" });
    }
}));
exports.startTokenCheckout = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info("🪙 startTokenCheckout payload", req.body);
    const { uid, priceId } = req.body || {};
    if (!uid || !priceId) {
        logger.warn("⚠️ Missing uid or priceId", { uid, priceId });
        res.status(400).json({ error: "Missing uid or priceId" });
        return;
    }
    const cleanId = cleanPriceId(priceId);
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
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
        const metadata = { uid, type: "tokens" };
        if (tokens)
            metadata.tokens = String(tokens);
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
    }
    catch (err) {
        logTokenVerificationError('startTokenCheckout', authData.token, err);
        res
            .status(500)
            .json({ error: err?.message || "Failed to start checkout" });
    }
}));
exports.createCheckoutSession = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
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
    const allowedTokenAmounts = [20, 50, 100];
    if (!allowedTokenAmounts.includes(tokenAmount)) {
        logger.warn('⚠️ Invalid tokenAmount value', { tokenAmount });
        res.status(400).json({ error: 'Invalid tokenAmount' });
        return;
    }
    const stripeSecret = functions.config().stripe?.secret;
    if (!stripeSecret) {
        logger.error('Stripe secret not configured');
        res.status(500).json({ error: 'Stripe not configured' });
        return;
    }
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    try {
        const userRef = db.collection('users').doc(uid);
        const snap = await userRef.get();
        let customerId = snap.data()?.stripeCustomerId;
        if (!customerId) {
            const userRecord = await auth.getUser(uid);
            const customer = await stripeClient.customers.create({
                email: userRecord.email ?? undefined,
                metadata: { uid },
            });
            customerId = customer.id;
            await userRef.set({ stripeCustomerId: customerId }, { merge: true });
            logger.info('Stripe customer created', { uid, customerId });
        }
        else {
            logger.info('Stripe customer reused', { uid, customerId });
        }
        const ephemeralKey = await stripeClient.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2023-10-16' });
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
                type: 'tokens',
                tokenAmount: String(tokenAmount),
                tokens: String(tokenAmount),
                priceId: cleanId,
            },
            automatic_payment_methods: { enabled: true },
        });
        const clientSecret = intent.client_secret;
        const ephSecret = ephemeralKey.secret;
        if (!clientSecret || !ephSecret || !customerId) {
            logger.error('Missing Stripe values for checkout session', {
                clientSecret: !!clientSecret,
                ephSecret: !!ephSecret,
                customerId: !!customerId,
            });
            res.status(500).json({ error: 'Failed to create checkout' });
            return;
        }
        try {
            await db
                .collection('users')
                .doc(uid)
                .collection('transactions')
                .doc(intent.id)
                .set({
                type: 'token',
                tokenAmount,
                amount,
                currency: price.currency,
                paymentIntentId: intent.id,
                priceId: cleanId,
                status: intent.status,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        catch (fireErr) {
            logger.error('Failed to log token transaction', {
                uid,
                paymentIntentId: intent.id,
                error: fireErr,
            });
        }
        logger.info(`✅ PaymentIntent created ${intent.id}`);
        res.status(200).json({
            clientSecret,
            ephemeralKey: ephSecret,
            customerId,
        });
    }
    catch (err) {
        logger.error('createCheckoutSession failed', err);
        res.status(500).json({ error: err?.message || 'Failed to create checkout' });
    }
}));
exports.createStripeSubscriptionIntent = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
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
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    try {
        const userRef = db.collection('users').doc(uid);
        const snap = await userRef.get();
        let customerId = snap.data()?.stripeCustomerId;
        if (!customerId) {
            const userRecord = await auth.getUser(uid);
            const customer = await stripeClient.customers.create({
                email: userRecord.email ?? undefined,
                metadata: { uid, tier },
            });
            customerId = customer.id;
            await userRef.set({ stripeCustomerId: customerId }, { merge: true });
            logger.info('Stripe customer created', { uid, customerId });
        }
        else {
            await stripeClient.customers.update(customerId, { metadata: { uid, tier } });
            logger.info('Stripe customer reused', { uid, customerId });
        }
        const ephemeralKey = await stripeClient.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2023-10-16' });
        const subscriptionRes = await stripeClient.subscriptions.create({
            customer: customerId,
            items: [{ price: cleanPriceId(priceId) }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
            metadata: { uid, tier },
        });
        const subscription = subscriptionRes;
        const { id: subscriptionId, status, current_period_start, current_period_end, latest_invoice, } = subscription;
        const latestInvoice = latest_invoice;
        const clientSecret = latestInvoice?.payment_intent?.client_secret;
        const invoiceId = latestInvoice?.id;
        const amount = typeof latestInvoice?.amount_due === 'number' ? latestInvoice.amount_due : 0;
        const currency = latestInvoice?.currency ?? 'usd';
        if (!clientSecret || !invoiceId || !ephemeralKey.secret) {
            logger.error('Failed to obtain subscription details', {
                subscriptionId,
                hasClientSecret: !!clientSecret,
                invoiceId,
                hasEphKey: !!ephemeralKey.secret,
            });
            res.status(500).json({ error: 'Failed to obtain client secret' });
            return;
        }
        try {
            await db
                .collection('subscriptions')
                .doc(uid)
                .set({
                active: {
                    subscriptionId,
                    status,
                    tier,
                    invoiceId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    currentPeriodStart: current_period_start
                        ? admin.firestore.Timestamp.fromMillis(current_period_start * 1000)
                        : undefined,
                    currentPeriodEnd: current_period_end
                        ? admin.firestore.Timestamp.fromMillis(current_period_end * 1000)
                        : undefined,
                },
            }, { merge: true });
            await userRef.set({ isSubscribed: true }, { merge: true });
            await userRef
                .collection('transactions')
                .doc(invoiceId)
                .set({
                type: 'subscription',
                tier,
                subscriptionId,
                invoiceId,
                amount,
                currency,
                status,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        catch (fireErr) {
            logger.error('Failed to persist subscription data', {
                uid,
                invoiceId,
                error: fireErr,
            });
        }
        res.status(200).json({
            clientSecret,
            ephemeralKey: ephemeralKey.secret,
            customerId,
        });
    }
    catch (err) {
        logger.error('createStripeSubscriptionIntent failed', err);
        res.status(500).json({ error: err?.message || 'Failed to create subscription' });
    }
}));
exports.startDonationCheckout = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info("💖 startDonationCheckout payload", req.body);
    const { userId, amount } = req.body || {};
    if (!userId || typeof amount !== "number" || amount <= 0) {
        logger.warn("⚠️ Missing fields", { userId: !!userId, amount });
        res.status(400).json({ error: "Missing required fields" });
        return;
    }
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
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
    }
    catch (err) {
        logTokenVerificationError('startDonationCheckout', authData.token, err);
        res
            .status(500)
            .json({ error: err?.message || "Failed to start donation" });
    }
}));
exports.startCheckoutSession = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info("📦 startCheckoutSession payload", req.body);
    logger.debug("startCheckoutSession headers", req.headers);
    logger.info("🔐 Stripe Secret:", STRIPE_SECRET_KEY ? "\u2713 set" : "\u2717 missing");
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
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
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
        const metadata = { uid: userId };
        if (tokens)
            metadata.tokens = String(tokens);
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
    }
    catch (err) {
        logTokenVerificationError('startCheckoutSession', authData.token, err);
        res
            .status(500)
            .json({ error: err?.message || "Failed to start checkout" });
    }
}));
exports.createStripeCheckout = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
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
    const missing = [];
    if (!uid)
        missing.push("uid");
    if (!email)
        missing.push("email");
    if (!type)
        missing.push("type");
    if (type === "subscription" && !priceId)
        missing.push("priceId");
    if (type === "tokens" && !priceId && !quantity)
        missing.push("priceId or quantity");
    if (missing.length) {
        logger.warn("⚠️ Missing fields", { missing, body: req.body });
        res.status(400).json({ error: `Missing required field: ${missing.join(', ')}` });
        return;
    }
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
        logTokenVerificationError("createStripeCheckout", undefined, err);
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    let finalPriceId = cleanId;
    if (type === "tokens" && !cleanId) {
        if (quantity === 20)
            finalPriceId = STRIPE_20_TOKEN_PRICE_ID;
        else if (quantity === 50)
            finalPriceId = STRIPE_50_TOKEN_PRICE_ID;
        else if (quantity === 100)
            finalPriceId = STRIPE_100_TOKEN_PRICE_ID;
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
        const metadata = { uid, type };
        let tokenCount = null;
        if (type === "tokens") {
            tokenCount = quantity ?? getTokensFromPriceId(finalPriceId);
            if (tokenCount)
                metadata.tokens = String(tokenCount);
        }
        const session = await stripe.checkout.sessions.create({
            mode: type === "subscription" ? "subscription" : "payment",
            line_items: [{ price: finalPriceId, quantity: 1 }],
            success_url: returnUrl || STRIPE_SUCCESS_URL,
            cancel_url: STRIPE_CANCEL_URL,
            client_reference_id: uid,
            customer_email: email,
            metadata,
        });
        logger.info(`✅ Stripe session created ${session.id}`);
        res.status(200).json({ url: session.url });
    }
    catch (err) {
        logTokenVerificationError('createStripeCheckout', authData.token, err);
        res.status(500).json({ error: err?.message || 'Failed to start checkout' });
    }
}));
exports.updateStreakAndXP = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
        logTokenVerificationError("updateStreakAndXP", (0, helpers_1.extractAuthToken)(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const type = req.body?.type || "general";
        await updateStreakAndXPInternal(authData.uid, type);
        res.status(200).json({ message: "Streak updated" });
    }
    catch (err) {
        (0, helpers_1.logError)("updateStreakAndXP", err);
        res.status(500).json({ error: err.message || "Failed" });
    }
}));
exports.getUserProfile = functions
    .https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
        logTokenVerificationError("getUserProfile", (0, helpers_1.extractAuthToken)(req), err);
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const reqUid = typeof req.query.uid === "string"
        ? req.query.uid
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
    }
    catch (err) {
        (0, helpers_1.logError)("getUserProfile", err);
        res.status(500).json({ error: err.message || "Failed" });
    }
}));
async function ensureDocument(path, data) {
    const ref = db.doc(path);
    const snap = await ref.get();
    if (!snap.exists) {
        logger.info("🛠 Creating doc with merge", { path });
        await ref.set(data, { merge: true });
        logger.info("✅ Doc ensured", { path });
    }
}
exports.seedFirestore = functions
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
            ensureDocument('religionChats/seed-user/messages/welcome', { text: 'Welcome to religion chat!' }),
            ensureDocument('tempReligionChat/seed-user/messages/intro', { text: 'This is a temporary chat placeholder.' }),
            ensureDocument('confessionalSessions/seed-user/messages/first', { text: 'Sample confession message.' }),
        ]);
        res.status(200).json({ message: 'Firestore seeded' });
    }
    catch (err) {
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
exports.backfillUserProfiles = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }
    let processed = 0;
    let updated = 0;
    let lastDoc = null;
    const batchSize = 500;
    const isMissing = (v) => v === undefined || v === null;
    const isMissingString = (v) => isMissing(v) || (typeof v === "string" && v.trim() === "");
    while (true) {
        let query = db
            .collection("users")
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(batchSize);
        if (lastDoc)
            query = query.startAfter(lastDoc);
        const snap = await query.get();
        if (snap.empty)
            break;
        for (const doc of snap.docs) {
            const data = doc.data();
            const updates = {};
            const serverTs = admin.firestore.FieldValue.serverTimestamp();
            if (isMissingString(data.email))
                updates.email = "";
            if (typeof data.isSubscribed !== "boolean")
                updates.isSubscribed = false;
            if (isMissing(data.createdAt))
                updates.createdAt = serverTs;
            if (!data.challengeStreak)
                updates.challengeStreak = { count: 0, lastCompletedDate: null };
            if (typeof data.dailyChallengeCount !== "number")
                updates.dailyChallengeCount = 0;
            if (typeof data.dailySkipCount !== "number")
                updates.dailySkipCount = 0;
            if (!("lastChallengeLoadDate" in data))
                updates.lastChallengeLoadDate = null;
            if (!("lastSkipDate" in data))
                updates.lastSkipDate = null;
            if (typeof data.skipTokensUsed !== "number")
                updates.skipTokensUsed = 0;
            if (typeof data.nightModeEnabled !== "boolean")
                updates.nightModeEnabled = false;
            updates.profileComplete = true;
            if (typeof data.profileSchemaVersion !== "number")
                updates.profileSchemaVersion = 1;
            if (isMissing(data.lastActive))
                updates.lastActive = serverTs;
            if (isMissingString(data.religionPrefix))
                updates.religionPrefix = "";
            if (isMissingString(data.organizationId))
                updates.organizationId = null;
            if (isMissingString(data.preferredName))
                updates.preferredName = "";
            if (isMissingString(data.pronouns))
                updates.pronouns = "";
            if (isMissingString(data.avatarURL))
                updates.avatarURL = "";
            if (isMissingString(data.displayName))
                updates.displayName = "";
            if (isMissingString(data.username))
                updates.username = "";
            if (isMissingString(data.region))
                updates.region = "";
            if (isMissingString(data.religion))
                updates.religion = "SpiritGuide";
            if (typeof data.tokens !== "number")
                updates.tokens = 0;
            if (typeof data.individualPoints !== "number")
                updates.individualPoints = 0;
            updates.onboardingComplete = true;
            if (!("organization" in data))
                updates.organization = null;
            if (Object.keys(updates).length) {
                logger.info(`Backfilling user ${doc.id}`, updates);
                await doc.ref.set(updates, { merge: true });
                updated++;
            }
            else {
                logger.info(`No updates needed for ${doc.id}`);
            }
            processed++;
        }
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < batchSize)
            break;
    }
    logger.info(`Backfill complete`, { processed, updated });
    return { processed, updated };
});
logger.info('Initializing updateUserProfile (auth required)');
exports.updateUserProfile = functions.https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    // Requires auth
    let uid;
    try {
        const authData = await (0, helpers_1.verifyAuth)(req);
        uid = authData.uid;
    }
    catch (err) {
        logTokenVerificationError('updateUserProfile', (0, helpers_1.extractAuthToken)(req), err);
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const fields = req.body?.fields;
    if (typeof fields !== 'object' || Array.isArray(fields)) {
        res.status(400).json({ error: 'fields must be an object' });
        return;
    }
    logger.info(`updateUserProfile`, { uid, fields });
    try {
        await db.collection('users').doc(uid).set(fields, { merge: true });
        res.status(200).json({ success: true });
    }
    catch (err) {
        (0, helpers_1.logError)('updateUserProfile', err);
        res.status(500).json({ error: err?.message || 'Update failed' });
    }
}));
logger.info('Initializing postSignup (optional auth)');
exports.postSignup = functions.https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    // Allow unauthenticated; relies on input validation + rate limiting
    await new Promise((resolve) => (0, optionalAuth_1.optionalAuth)(req, res, resolve));
    const { localId, email, displayName, preferredName, avatarURL } = req.body || {};
    const uid = req.user?.uid || localId;
    if (typeof uid !== 'string' || !uid) {
        res.status(400).json({ error: 'Missing localId' });
        return;
    }
    if (email && typeof email !== 'string') {
        res.status(400).json({ error: 'Invalid email' });
        return;
    }
    if (displayName && typeof displayName !== 'string') {
        res.status(400).json({ error: 'Invalid displayName' });
        return;
    }
    if (preferredName && typeof preferredName !== 'string') {
        res.status(400).json({ error: 'Invalid preferredName' });
        return;
    }
    if (avatarURL && typeof avatarURL !== 'string') {
        res.status(400).json({ error: 'Invalid avatarURL' });
        return;
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const userData = {
        email: email ?? '',
        displayName: displayName ?? '',
        preferredName: preferredName ?? '',
        avatarURL: avatarURL ?? '',
        isSubscribed: false,
        createdAt: timestamp,
        lastActive: timestamp,
    };
    try {
        await db.doc(`users/${uid}`).set(userData, { merge: true });
        res.status(200).json({ success: true });
    }
    catch (err) {
        (0, helpers_1.logError)('postSignup', err);
        res.status(500).json({ error: err?.message || 'Profile creation failed' });
    }
}));
exports.createStripeSetupIntent = functions.https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info('createStripeSetupIntent called', { body: req.body });
    logger.debug('Verifying auth token');
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
        logger.debug('Auth token verified', { uid: authData.uid });
    }
    catch (err) {
        logTokenVerificationError('createStripeSetupIntent', (0, helpers_1.extractAuthToken)(req), err);
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
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    logger.debug('Retrieving or creating Stripe customer');
    let customerId;
    try {
        const userRef = db.collection('users').doc(uid);
        const snap = await userRef.get();
        customerId = snap.data()?.stripeCustomerId;
        if (!customerId) {
            const userRecord = await auth.getUser(uid);
            const customer = await stripeClient.customers.create({
                email: userRecord.email ?? undefined,
                metadata: { uid },
            });
            customerId = customer.id;
            await userRef.set({ stripeCustomerId: customerId }, { merge: true });
            logger.info('Stripe customer created', { uid, customerId });
        }
        else {
            logger.info('Stripe customer reused', { uid, customerId });
        }
    }
    catch (err) {
        logger.error('Failed to retrieve or create Stripe customer', err);
        res.status(500).json({ error: 'Unable to create customer' });
        return;
    }
    logger.debug('Creating Stripe ephemeral key');
    let ephemeralKey;
    try {
        ephemeralKey = await stripeClient.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2023-10-16' });
    }
    catch (err) {
        logger.error('Stripe ephemeralKey creation failed', err);
        res.status(500).json({ error: err?.message || 'Ephemeral key failed' });
        return;
    }
    let intent;
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
            const metadata = {
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
        }
        catch (err) {
            logger.error('Stripe PaymentIntent creation failed', err);
            res.status(500).json({ error: err?.message || 'PaymentIntent creation failed' });
            return;
        }
    }
    else {
        logger.debug('Creating Stripe SetupIntent for customer', { customerId });
        try {
            const eventType = data.eventType || data.type;
            const metadata = { uid };
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
        }
        catch (err) {
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
}));
exports.finalizePaymentIntent = functions.https.onRequest((0, helpers_1.withCors)(async (req, res) => {
    logger.info('finalizePaymentIntent called', { body: req.body });
    let authData;
    try {
        authData = await (0, helpers_1.verifyAuth)(req);
    }
    catch (err) {
        logTokenVerificationError('finalizePaymentIntent', (0, helpers_1.extractAuthToken)(req), err);
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
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    try {
        const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== 'succeeded') {
            res.status(400).json({ error: 'Payment not completed' });
            return;
        }
        const uid = authData.uid;
        if (mode === 'subscription') {
            await db.doc(`users/${uid}`).set({
                isSubscribed: true,
                subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`User ${uid} subscribed`);
            await db.doc(`users/${uid}/transactions/${paymentIntentId}`).set({
                amount: intent.amount,
                currency: intent.currency,
                stripePaymentIntentId: paymentIntentId,
                paymentMethod: intent.payment_method_types?.[0] || 'unknown',
                status: intent.status,
                type: 'subscription',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log('Transaction logged');
        }
        else if (mode === 'payment') {
            await addTokens(uid, tokenAmount);
            console.log(`Added ${tokenAmount} tokens to ${uid}`);
        }
        else if (mode === 'donation') {
            await db.doc(`users/${uid}/donations/${paymentIntentId}`).set({
                amount: intent.amount,
                currency: intent.currency,
                created: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Donation logged for ${uid}`);
        }
        await db.doc(`users/${uid}/payments/${paymentIntentId}`).set({
            mode,
            status: 'completed',
            created: admin.firestore.FieldValue.serverTimestamp(),
            amount: intent.amount,
        }, { merge: true });
        res.status(200).json({ success: true });
    }
    catch (err) {
        logger.error('finalizePaymentIntent failed', err);
        res.status(500).json({ error: err?.message || 'Failed to finalize payment' });
    }
}));
exports.createTokenPurchaseSheet = functions.https.onCall(async (data, context) => {
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
    const publishableKey = functions.config().stripe?.publishable || STRIPE_PUBLISHABLE_KEY;
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    let customerId;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    customerId = snap.data()?.stripeCustomerId;
    if (!customerId) {
        const userRecord = await auth.getUser(uid);
        const customer = await stripeClient.customers.create({
            email: userRecord.email ?? undefined,
            metadata: { uid },
        });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }
    const ephemeralKey = await stripeClient.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2023-10-16' });
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
});
exports.createSubscriptionSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = data?.uid;
    if (!uid || uid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'UID mismatch');
    }
    const stripeSecret = functions.config().stripe?.secret || STRIPE_SECRET_KEY;
    if (!stripeSecret) {
        throw new functions.https.HttpsError('internal', 'Stripe not configured');
    }
    const subscriptionPriceId = functions.config().stripe?.sub_price_id || process.env.STRIPE_SUB_PRICE_ID;
    if (!subscriptionPriceId) {
        throw new functions.https.HttpsError('internal', 'Subscription price not configured');
    }
    const stripeClient = new stripe_1.default(stripeSecret, { apiVersion: '2023-10-16' });
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    let customerId = snap.data()?.stripeCustomerId;
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
});
var firestoreArchitecture_1 = require("./firestoreArchitecture");
Object.defineProperty(exports, "onCompletedChallengeCreate", { enumerable: true, get: function () { return firestoreArchitecture_1.onCompletedChallengeCreate; } });
var stripeWebhooks_1 = require("./stripeWebhooks");
Object.defineProperty(exports, "handleStripeWebhookV2", { enumerable: true, get: function () { return stripeWebhooks_1.handleStripeWebhookV2; } });
var cleanLegacySubscriptionFields_1 = require("./cleanLegacySubscriptionFields");
Object.defineProperty(exports, "cleanLegacySubscriptionFields", { enumerable: true, get: function () { return cleanLegacySubscriptionFields_1.cleanLegacySubscriptionFields; } });
var userCounts_1 = require("./userCounts");
Object.defineProperty(exports, "userCountsOnWrite", { enumerable: true, get: function () { return userCounts_1.userCountsOnWrite; } });
Object.defineProperty(exports, "recomputeAllCounts", { enumerable: true, get: function () { return userCounts_1.recomputeAllCounts; } });
