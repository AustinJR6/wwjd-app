import * as admin from 'firebase-admin';

const db = admin.firestore();

export async function checkRateLimit(uid: string, limit = 10, windowSec = 60): Promise<void> {
  const ref = db.doc(`rate_limits/${uid}`);
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoff = nowSec - windowSec;
  // First, append timestamp with arrayUnion to reduce contention
  await ref.set({ events: admin.firestore.FieldValue.arrayUnion(nowSec) }, { merge: true });
  // Then prune if needed and enforce limit atomically
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const arr: number[] = snap.exists ? ((snap.data() as any)?.events || []) : [];
    const pruned = arr.filter((ts) => ts > cutoff).sort((a, b) => a - b);
    if (pruned.length > 50) pruned.splice(0, pruned.length - 50);
    if (pruned.length > limit) {
      t.set(ref, { events: pruned }, { merge: true });
      throw Object.assign(new Error('Rate limit exceeded'), { code: 429 });
    }
    t.set(ref, { events: pruned }, { merge: true });
  });
}
