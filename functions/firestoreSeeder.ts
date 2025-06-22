import { db } from './firebase';

export async function seedFirestore() {
  // Add your seeding logic here
  return db.collection('example').doc('seed').set({ seeded: true });
}

if (require.main === module) {
  seedFirestore().then(() => {
    console.log('Firestore seeded');
  });
}
