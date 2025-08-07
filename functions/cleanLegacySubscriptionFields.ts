import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

export const cleanLegacySubscriptionFields = functions.https.onCall(async (data, context) => {
  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID is required');
  }

  const subRef = firestore.doc(`subscriptions/${uid}`);
  const subSnap = await subRef.get();

  if (!subSnap.exists) {
    console.warn(`No subscription document found for UID: ${uid}`);
    return { cleaned: false };
  }

  const subData = subSnap.data();
  if (subData && 'tier' in subData) {
    await subRef.update({ tier: admin.firestore.FieldValue.delete() });
    console.log(`🧹 Cleaned up legacy 'tier' field for UID: ${uid}`);
    return { cleaned: true };
  }

  console.log(`✅ No legacy 'tier' field to clean for UID: ${uid}`);
  return { cleaned: false };
});
