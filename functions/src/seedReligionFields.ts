import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedReligionFields() {
  let total = 0;
  let last: FirebaseFirestore.DocumentSnapshot | undefined;
  const BATCH_SIZE = 100;
  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection('religion')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const name = data.name || doc.id;
      batch.set(
        doc.ref,
        {
          prompt: data.prompt || `Speak as a compassionate guide, representing the spirit of ${name}.`,
          aiVoice: data.aiVoice || 'Voice Title',
          language: data.language || 'en',
          totalPoints: data.totalPoints ?? 0,
        },
        { merge: true },
      );
    });
    await batch.commit();
    total += snap.docs.length;
    last = snap.docs[snap.docs.length - 1];
  }
  console.log(`Updated ${total} religion docs`);
}

if (require.main === module) {
  seedReligionFields()
    .then(() => process.exit(0))
    .catch((err) => { console.error('Failed to seed religions', err); process.exit(1); });
}
