import * as admin from 'firebase-admin';
import { seedRegions } from './seedRegions';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedSubscriptionsForUsers() {
  let createdCount = 0;
  let last: FirebaseFirestore.DocumentSnapshot | undefined;
  const BATCH_SIZE = 100;
  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection('users')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const subRef = db.collection('subscriptions').doc(doc.id);
      const subSnap = await subRef.get();
      if (!subSnap.exists) {
        await subRef.set({
          active: false,
          tier: 'free',
          subscribedAt: admin.firestore.Timestamp.now(),
          expiresAt: null,
        });
        createdCount += 1;
        console.log(`Created subscription for ${doc.id}`);
      }
    }
    last = snap.docs[snap.docs.length - 1];
  }
  console.log(`Created ${createdCount} new subscription(s)`);
}

if (require.main === module) {
  Promise.all([seedSubscriptionsForUsers(), seedRegions()])
    .then(() => {
      console.log('Firestore seeding complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Firestore seeding failed', err);
      process.exit(1);
    });
}
