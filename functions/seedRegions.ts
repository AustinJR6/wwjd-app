import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export async function seedRegions() {
  const regions = [
    { name: 'Southwest', code: 'SW', sortOrder: 1 },
    { name: 'Northeast', code: 'NE', sortOrder: 2 },
    { name: 'Midwest', code: 'MW', sortOrder: 3 },
    { name: 'Southeast', code: 'SE', sortOrder: 4 },
    { name: 'Northwest', code: 'NW', sortOrder: 5 },
  ];

  const batch = db.batch();
  regions.forEach((r) => {
    const ref = db.collection('regions').doc(r.code);
    batch.set(ref, r, { merge: true });
  });
  await batch.commit();
  console.log(`Seeded ${regions.length} regions`);
}

if (require.main === module) {
  seedRegions()
    .then(() => {
      console.log('Regions seeding complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Regions seeding failed', err);
      process.exit(1);
    });
}
