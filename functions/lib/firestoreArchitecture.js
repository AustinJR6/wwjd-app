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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConfessionalWriteSessions = exports.onConfessionalWriteChats = exports.onCompletedChallengeCreate = exports.onActiveChallengeDelete = void 0;
exports.generateDailyChallengeForUser = generateDailyChallengeForUser;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("./firebase");
const geminiUtils_1 = require("./geminiUtils");
// Generate a daily challenge for a user and store in Firestore
async function generateDailyChallengeForUser(uid, religionId) {
    const recentSnap = await firebase_1.db
        .collection('dailyChallenges')
        .where('uid', '==', uid)
        .orderBy('dateGenerated', 'desc')
        .limit(7)
        .get();
    const recentTexts = recentSnap.docs.map(d => d.data()?.challengeText).filter(Boolean);
    const avoid = recentTexts.map((c, i) => `#${i + 1}: ${c}`).join('\n');
    const { name, aiVoice } = await (0, geminiUtils_1.fetchReligionContext)(religionId);
    const prompt = `As a ${aiVoice} within the ${name} tradition, generate a short unique spiritual challenge that does not repeat any of the following:\n${avoid}`;
    const model = (0, geminiUtils_1.createGeminiModel)();
    const chat = await model.startChat({ history: [] });
    const result = await chat.sendMessage(prompt);
    const text = result?.response?.text?.() || 'Perform a random act of kindness.';
    const challengeData = {
        uid,
        religionId: religionId || 'SpiritGuide',
        challengeText: text.trim(),
        dateGenerated: admin.firestore.FieldValue.serverTimestamp(),
    };
    await firebase_1.db.collection('dailyChallenges').add(challengeData);
    await firebase_1.db.doc(`activeChallenges/${uid}`).set(challengeData, { merge: true });
    return text.trim();
}
// Trigger: generate new challenge when user completes or abandons current one
exports.onActiveChallengeDelete = functions.firestore
    .document('activeChallenges/{uid}')
    .onDelete(async (_, context) => {
    const uid = context.params.uid;
    try {
        const userDoc = await firebase_1.db.doc(`users/${uid}`).get();
        const religion = userDoc.data()?.religion;
        await generateDailyChallengeForUser(uid, religion);
    }
    catch (err) {
        functions.logger.error('onActiveChallengeDelete', err);
    }
});
// Trigger: update points and leaderboards when challenge completed
exports.onCompletedChallengeCreate = functions.firestore
    .document('completedChallenges/{challengeId}')
    .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const uid = data.uid;
    if (!uid) {
        functions.logger.error('onCompletedChallengeCreate: missing uid');
        return;
    }
    const points = typeof data.points === 'number' ? data.points : 10;
    try {
        const userRef = firebase_1.db.doc(`users/${uid}`);
        const userSnap = await userRef.get();
        const userData = userSnap.data() || {};
        const inc = admin.firestore.FieldValue.increment(points);
        const tasks = [
            userRef.set({ individualPoints: inc }, { merge: true }),
        ];
        const org = userData.organization;
        const region = userData.region;
        const religion = userData.religion;
        if (org) {
            functions.logger.info('🛠 Updating organization doc with merge', { org });
            tasks.push(firebase_1.db.doc(`organizations/${org}`).set({ orgPoints: inc }, { merge: true }));
        }
        if (region) {
            functions.logger.info('🛠 Updating region doc with merge', { region });
            tasks.push(firebase_1.db.doc(`regions/${region}`).set({ regionPoints: inc }, { merge: true }));
        }
        if (religion) {
            functions.logger.info('🛠 Updating religion doc with merge', { religion });
            tasks.push(firebase_1.db.doc(`religion/${religion}`).set({ religionPoints: inc }, { merge: true }));
        }
        tasks.push(firebase_1.db
            .doc('leaderboards/global')
            .set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
        await Promise.all(tasks);
        functions.logger.info('✅ Points updated for completion', { uid, points });
    }
    catch (err) {
        functions.logger.error('onCompletedChallengeCreate', err);
    }
});
// Trigger: prevent confessional history persistence for unsubscribed/opt-out users
exports.onConfessionalWriteChats = functions.firestore
    .document('confessionalChats/{uid}/messages/{msgId}')
    .onWrite(async (change, context) => {
    const uid = context.params.uid;
    try {
        const user = await firebase_1.db.doc(`users/${uid}`).get();
        const data = user.data() || {};
        const subscribed = !!data.isSubscribed;
        const optedIn = !!data.confessionalOptIn;
        if (!subscribed || !optedIn) {
            if (change.after.exists)
                await change.after.ref.delete();
        }
    }
    catch (err) {
        functions.logger.error('onConfessionalWriteChats', err);
    }
});
exports.onConfessionalWriteSessions = functions.firestore
    .document('confessionalSessions/{uid}/messages/{msgId}')
    .onWrite(async (change, context) => {
    const uid = context.params.uid;
    try {
        const user = await firebase_1.db.doc(`users/${uid}`).get();
        const data = user.data() || {};
        const subscribed = !!data.isSubscribed;
        const optedIn = !!data.confessionalOptIn;
        if (!subscribed || !optedIn) {
            if (change.after.exists)
                await change.after.ref.delete();
        }
    }
    catch (err) {
        functions.logger.error('onConfessionalWriteSessions', err);
    }
});
