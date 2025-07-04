import * as admin from 'firebase-admin';
import { seedRegions } from './seedRegions';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedSubscriptionsForUsers() {
  const usersSnap = await db.collection('users').get();
  let createdCount = 0;
  const operations = usersSnap.docs.map(async (doc) => {
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
  });
  await Promise.all(operations);
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
