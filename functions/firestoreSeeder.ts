import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedSubscriptionsForUsers() {
  const usersSnap = await db.collection('users').get();
  const promises = usersSnap.docs.map(async (doc) => {
    const subRef = db.collection('subscriptions').doc(doc.id);
    const subSnap = await subRef.get();
    if (!subSnap.exists) {
      await subRef.set({
        active: false,
        tier: 'free',
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
      });
      console.log(`Created subscription for ${doc.id}`);
    }
  });
  await Promise.all(promises);
}

if (require.main === module) {
  seedSubscriptionsForUsers()
    .then(() => {
      console.log('Firestore seeding complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Firestore seeding failed', err);
      process.exit(1);
    });
}
