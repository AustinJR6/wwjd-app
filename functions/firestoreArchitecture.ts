import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { db } from './firebase';
import { createGeminiModel, fetchReligionContext } from './geminiUtils';

// Generate a daily challenge for a user and store in Firestore
export async function generateDailyChallengeForUser(uid: string, religionId?: string): Promise<string> {
  const recentSnap = await db
    .collection('dailyChallenges')
    .where('uid', '==', uid)
    .orderBy('dateGenerated', 'desc')
    .limit(7)
    .get();
  const recentTexts = recentSnap.docs.map(d => d.data()?.challengeText).filter(Boolean);
  const avoid = recentTexts.map((c, i) => `#${i + 1}: ${c}`).join('\n');
  const { name, aiVoice } = await fetchReligionContext(religionId);
  const prompt = `As a ${aiVoice} within the ${name} tradition, generate a short unique spiritual challenge that does not repeat any of the following:\n${avoid}`;
  const model = createGeminiModel();
  const chat = await model.startChat({ history: [] });
  const result = await chat.sendMessage(prompt);
  const text = result?.response?.text?.() || 'Perform a random act of kindness.';
  const challengeData = {
    uid,
    religionId: religionId || 'SpiritGuide',
    challengeText: text.trim(),
    dateGenerated: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('dailyChallenges').add(challengeData);
  await db.doc(`activeChallenges/${uid}`).set(challengeData, { merge: true });
  return text.trim();
}

// Trigger: generate new challenge when user completes or abandons current one
export const onActiveChallengeDelete = functions.firestore
  .document('activeChallenges/{uid}')
  .onDelete(async (_, context) => {
    const uid = context.params.uid;
    try {
      const userDoc = await db.doc(`users/${uid}`).get();
      const religion = userDoc.data()?.religion as string | undefined;
      await generateDailyChallengeForUser(uid, religion);
    } catch (err) {
      functions.logger.error('onActiveChallengeDelete', err);
    }
  });

// Trigger: update points and leaderboards when challenge completed
export const onCompletedChallengeCreate = functions.firestore
  .document('completedChallenges/{uid}/{challengeId}')
  .onCreate(async (snap, context) => {
    const uid = context.params.uid;
    const data = snap.data() || {};
    const points = typeof data.points === 'number' ? data.points : 10;
    try {
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const updates: any = { individualPoints: admin.firestore.FieldValue.increment(points) };
      await userRef.set(updates, { merge: true });

      const org = userData.organization as string | undefined;
      const region = userData.region as string | undefined;
      const religion = userData.religion as string | undefined;
      if (org) await db.doc(`organizations/${org}`).set({ orgPoints: admin.firestore.FieldValue.increment(points) }, { merge: true });
      if (region) await db.doc(`regions/${region}`).set({ regionPoints: admin.firestore.FieldValue.increment(points) }, { merge: true });
      if (religion) await db.doc(`religion/${religion}`).set({ religionPoints: admin.firestore.FieldValue.increment(points) }, { merge: true });

      await db.doc('leaderboards/global').set({ updated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
      functions.logger.error('onCompletedChallengeCreate', err);
    }
  });

// Trigger: prevent confessional history persistence for unsubscribed/opt-out users
export const onConfessionalWrite = functions.firestore
  .document('{collectionId=confessionalChats|confessionalSessions}/{uid}/messages/{msgId}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    try {
      const user = await db.doc(`users/${uid}`).get();
      const data = user.data() || {};
      const subscribed = !!data.isSubscribed;
      const optedIn = !!data.confessionalOptIn;
      if (!subscribed || !optedIn) {
        if (change.after.exists) await change.after.ref.delete();
      }
    } catch (err) {
      functions.logger.error('onConfessionalWrite', err);
    }
  });

