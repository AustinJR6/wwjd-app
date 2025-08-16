import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { DocumentSnapshot } from 'firebase-functions/v1/firestore';
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
  .onDelete(async (_: functions.firestore.DocumentSnapshot, context: functions.EventContext) => {
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
  .document('completedChallenges/{challengeId}')
  .onCreate(async (snap: functions.firestore.DocumentSnapshot, context: functions.EventContext) => {
    const data = snap.data() || {};
    const uid = data.uid as string | undefined;
    if (!uid) {
      functions.logger.error('onCompletedChallengeCreate: missing uid');
      return;
    }
    const points = typeof data.points === 'number' ? data.points : 10;
    try {
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const inc = admin.firestore.FieldValue.increment(points);
      const tasks: Promise<any>[] = [
        userRef.set({ individualPoints: inc }, { merge: true }),
      ];

      const org = userData.organization as string | undefined;
      const region = userData.region as string | undefined;
      const religion = userData.religion as string | undefined;
      if (org) {
        functions.logger.info('🛠 Updating organization doc with merge', { org });
        tasks.push(db.doc(`organizations/${org}`).set({ orgPoints: inc }, { merge: true }));
      }
      if (region) {
        functions.logger.info('🛠 Updating region doc with merge', { region });
        tasks.push(db.doc(`regions/${region}`).set({ regionPoints: inc }, { merge: true }));
      }
      if (religion) {
        functions.logger.info('🛠 Updating religion doc with merge', { religion });
        tasks.push(db.doc(`religion/${religion}`).set({ religionPoints: inc }, { merge: true }));
      }

      tasks.push(
        db
          .doc('leaderboards/global')
          .set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      );

      await Promise.all(tasks);
      functions.logger.info('✅ Points updated for completion', { uid, points });
    } catch (err) {
      functions.logger.error('onCompletedChallengeCreate', err);
    }
  });

// Trigger: prevent confessional history persistence for unsubscribed/opt-out users
export const onConfessionalWriteChats = functions.firestore
  .document('confessionalChats/{uid}/messages/{msgId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
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
      functions.logger.error('onConfessionalWriteChats', err);
    }
  });

export const onConfessionalWriteSessions = functions.firestore
  .document('confessionalSessions/{uid}/messages/{msgId}')
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
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
      functions.logger.error('onConfessionalWriteSessions', err);
    }
  });

