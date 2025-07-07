import { db } from '../admin/firebase';

export async function incrementUserReligionOrgPoints(uid: string, points: number): Promise<void> {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new Error('User not found');
  }
  const data = userSnap.data() || {};
  const religion = data.religion as string | undefined;
  const organizationId = data.organizationId as string | undefined;

  console.log('➡️ incrementUserReligionOrgPoints', { uid, points, religion, organizationId });

  await db.runTransaction(async (t: any) => {
    if (religion) {
      const ref = db.collection('religions').doc(religion);
      const snap = await t.get(ref);
      const current = snap.exists ? (snap.data()?.totalPoints || 0) : 0;
      t.set(ref, { name: religion, totalPoints: current + points }, { merge: true });
    }
    if (organizationId) {
      const ref = db.collection('organizations').doc(organizationId);
      const snap = await t.get(ref);
      const current = snap.exists ? (snap.data()?.totalPoints || 0) : 0;
      t.set(ref, { name: organizationId, totalPoints: current + points }, { merge: true });
    }
  });

  console.log('✅ incrementUserReligionOrgPoints complete', { uid, points });
}
