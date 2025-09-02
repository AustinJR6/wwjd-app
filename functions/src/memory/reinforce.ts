import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { checkRateLimit } from './rateLimit';

const db = admin.firestore();

export const reinforceMemories = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    await checkRateLimit(uid, 10, 60);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { memoryIds } = body;
    if (!Array.isArray(memoryIds) || !memoryIds.length) {
      res.status(400).json({ error: 'memoryIds required' });
      return;
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    for (const id of memoryIds.map(String)) {
      const ref = db.doc(`users/${uid}/memories/${id}`);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const curr = (snap.data() as any)?.decayScore || 1.0;
      const next = Math.min(1.4, curr + 0.1);
      batch.update(ref, { decayScore: next, updatedAt: now });
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 429) {
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export const setPinnedMemories = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { memoryId, pinned } = body;
    if (!memoryId || typeof pinned !== 'boolean') {
      res.status(400).json({ error: 'memoryId and pinned required' });
      return;
    }
    const ref = db.doc(`users/${uid}/memories/${String(memoryId)}`);
    await ref.set({ pinned, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
