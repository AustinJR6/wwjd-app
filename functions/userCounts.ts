import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

function normalizeId(v: unknown): string | null {
  if (typeof v === 'string') {
    const id = v.trim();
    return id ? id : null;
  }
  return null;
}

async function adjustCount(col: 'regions' | 'religions', id: string, delta: number): Promise<void> {
  const ref = db.collection(col).doc(id);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = snap.exists && typeof snap.data()?.userCount === 'number'
      ? (snap.data()!.userCount as number)
      : 0;
    const next = Math.max(0, current + delta);
    t.set(ref, { userCount: next }, { merge: true });
  });
}

export const userCountsOnWrite = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    const beforeRegion = normalizeId(before?.regionId ?? before?.region)?.toLowerCase();
    const afterRegion = normalizeId(after?.regionId ?? after?.region)?.toLowerCase();
    const beforeRel = normalizeId(before?.religionId ?? before?.religion);
    const afterRel = normalizeId(after?.religionId ?? after?.religion);
    console.log('[userCounts]', { uid, beforeRel, afterRel, beforeRegion, afterRegion });

    const jobs: Promise<void>[] = [];

    const log = (col: string, id: string, delta: number, reason: string) => {
      functions.logger.info(`[userCounts] ${col}/${id} ${delta >= 0 ? '+' : ''}${delta} (uid=${uid}, reason=${reason})`);
    };

    if (!before && after) {
      if (afterRegion) jobs.push(adjustCount('regions', afterRegion, 1).then(() => log('regions', afterRegion, 1, 'create')));
      if (afterRel) jobs.push(adjustCount('religions', afterRel, 1).then(() => log('religions', afterRel, 1, 'create')));
    } else if (before && after) {
      if (beforeRegion !== afterRegion) {
        if (beforeRegion)
          jobs.push(
            adjustCount('regions', beforeRegion, -1).then(() =>
              log('regions', beforeRegion, -1, 'update'),
            ),
          );
        if (afterRegion)
          jobs.push(
            adjustCount('regions', afterRegion, 1).then(() =>
              log('regions', afterRegion, 1, 'update'),
            ),
          );
      }
      if (beforeRel !== afterRel) {
        if (beforeRel)
          jobs.push(
            adjustCount('religions', beforeRel, -1).then(() =>
              log('religions', beforeRel, -1, 'update'),
            ),
          );
        if (afterRel)
          jobs.push(
            adjustCount('religions', afterRel, 1).then(() =>
              log('religions', afterRel, 1, 'update'),
            ),
          );
      }
    } else if (before && !after) {
      if (beforeRegion)
        jobs.push(
          adjustCount('regions', beforeRegion, -1).then(() =>
            log('regions', beforeRegion, -1, 'delete'),
          ),
        );
      if (beforeRel)
        jobs.push(
          adjustCount('religions', beforeRel, -1).then(() =>
            log('religions', beforeRel, -1, 'delete'),
          ),
        );
    }

    await Promise.all(jobs);
  });

export const recomputeAllCounts = functions.https.onRequest(async (req, res) => {
  const overwrite = req.query.overwriteMissing === 'true';
  const regionCounts = new Map<string, number>();
  const religionCounts = new Map<string, number>();
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  const start = Date.now();

  while (true) {
    let q: FirebaseFirestore.Query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const r = normalizeId(data.regionId ?? data.region)?.toLowerCase();
      const rel = normalizeId(data.religionId ?? data.religion);
      if (r) regionCounts.set(r, (regionCounts.get(r) || 0) + 1);
      if (rel) religionCounts.set(rel, (religionCounts.get(rel) || 0) + 1);
    });
    last = snap.docs[snap.docs.length - 1];
  }

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = db.batch();
  let ops = 0;
  const commitBatch = async () => {
    batches.push(batch);
    batch = db.batch();
    ops = 0;
  };

  if (overwrite) {
    const [regSnap, relSnap] = await Promise.all([
      db.collection('regions').get(),
      db.collection('religions').get(),
    ]);
    regSnap.docs.forEach((d) => {
      batch.set(d.ref, { userCount: 0 }, { merge: true });
      ops++; if (ops > 450) commitBatch();
    });
    relSnap.docs.forEach((d) => {
      batch.set(d.ref, { userCount: 0 }, { merge: true });
      ops++; if (ops > 450) commitBatch();
    });
  }

  for (const [id, count] of regionCounts) {
    batch.set(db.collection('regions').doc(id), { userCount: count }, { merge: true });
    ops++; if (ops > 450) commitBatch();
  }
  for (const [id, count] of religionCounts) {
    batch.set(db.collection('religions').doc(id), { userCount: count }, { merge: true });
    ops++; if (ops > 450) commitBatch();
  }

  batches.push(batch);
  await Promise.all(batches.map((b) => b.commit()));
  const duration = Date.now() - start;
  res.json({ regions: regionCounts.size, religions: religionCounts.size, durationMs: duration });
});
