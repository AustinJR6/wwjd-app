import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedReligionFields() {
  const snap = await db.collection('religion').get();
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    const name = data.name || doc.id;
    batch.set(doc.ref, {
      prompt: data.prompt || `Speak as a compassionate guide, representing the spirit of ${name}.`,
      aiVoice: data.aiVoice || 'Voice Title',
      language: data.language || 'en',
      totalPoints: data.totalPoints ?? 0,
    }, { merge: true });
  });
  await batch.commit();
  console.log(`Updated ${snap.docs.length} religion docs`);
}

if (require.main === module) {
  seedReligionFields()
    .then(() => process.exit(0))
    .catch((err) => { console.error('Failed to seed religions', err); process.exit(1); });
}
