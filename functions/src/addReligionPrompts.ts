import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const prompts: Record<string, string> = {
  christianity:
    'Respond as a compassionate Christian spiritual guide, with love, grace, and biblical wisdom.',
  islam:
    'Respond as a thoughtful Islamic scholar, grounded in the Quran and Hadith, with empathy and care.',
};

export async function addReligionPrompts() {
  const ops = Object.entries(prompts).map(([id, prompt]) =>
    db.collection('religion').doc(id).set({ prompt }, { merge: true })
  );
  await Promise.all(ops);
  console.log('Added prompts for', Object.keys(prompts).length, 'religions');
}

if (require.main === module) {
  addReligionPrompts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to add religion prompts', err);
      process.exit(1);
    });
}
