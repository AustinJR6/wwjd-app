import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { Buffer } from 'node:buffer';

const db = admin.firestore();
const storage = admin.storage();

export const exportMemories = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const user = (await db.doc(`users/${uid}`).get()).data() || {};
    const [goals, prefs, mems, facts, sums] = await Promise.all([
      db.collection(`users/${uid}/goals`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      db.collection(`users/${uid}/preferences`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))).catch(() => []),
      db.collection(`users/${uid}/memories`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      db.collection(`users/${uid}/facts`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))).catch(() => []),
      db.collection(`users/${uid}/session_summaries`).get().then((s) => s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    ]);

    const payload = { profile: user, goals, preferences: prefs, memories: mems, facts, session_summaries: sums };
    const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
    const bucket = storage.bucket();
    const ts = Date.now();
    const file = bucket.file(`exports/memories_${uid}_${ts}.json`);
    await file.save(buf, { contentType: 'application/json' });
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 24 * 60 * 60 * 1000 });
    res.json({ ok: true, url });
    return;
    res.status(401).json({ error: 'Unauthorized' });
    return;
    res.json({ ok: true, url });
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export const resetSessionSummaries = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const col = await db.collection(`users/${uid}/session_summaries`).get();
    const batch = db.batch();
    col.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export const eraseLongTermMemories = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const col = await db.collection(`users/${uid}/memories`).get();
    const batch = db.batch();
    col.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
