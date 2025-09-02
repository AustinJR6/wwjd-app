import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { embed, similarity } from '../vector';
import { checkRateLimit } from './rateLimit';

const db = admin.firestore();

export const prepareUserContext = functions.https.onRequest(async (req, res): Promise<void> => {
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
    const { userMessage } = body;
    if (!userMessage) {
      res.status(400).json({ error: 'userMessage required' });
      return;
    }
    const qMem = await db.collection(`users/${uid}/memories`).limit(100).get();
    const memories = qMem.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const msgEmb = await embed(String(userMessage));
    const scored = memories.map((m) => {
      const cos = Array.isArray(m.embedding) ? similarity(msgEmb, m.embedding as number[]) : 0;
      const imp = Number(m.importance || 0);
      const dec = Number(m.decayScore || 1.0);
      const pinBoost = m.pinned ? 0.05 : 0;
      const score = 0.7 * cos + 0.2 * (imp / 5) + 0.1 * dec + pinBoost;
      return { ...m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8);
    const topK = top.map((m) => `(${m.type}|${m.importance}) ${m.text}`);
    const selectedMemoryIds = top.map((m) => m.id);

    const userDoc = await db.doc(`users/${uid}`).get();
    const profile = userDoc.exists ? userDoc.data() || {} : {};
    const goalsSnap = await db.collection(`users/${uid}/goals`).where('status', '!=', 'done').limit(50).get().catch(() => ({ docs: [] } as any));
    const goals = goalsSnap.docs?.map((d: any) => d.data()?.title || d.data()?.text || '')?.filter(Boolean) || [];
    const sumSnap = await db.collection(`users/${uid}/session_summaries`).orderBy('createdAt', 'desc').limit(1).get().catch(() => ({ docs: [] } as any));
    const sessionSummary = sumSnap.docs?.[0]?.data()?.text || '';

    res.json({
      ok: true,
      context: {
        profile: JSON.stringify({ username: profile.username, displayName: profile.displayName, region: profile.region, religion: profile.religion }),
        goals,
        memories: topK,
        sessionSummary,
        selectedMemoryIds,
      },
    });
  } catch (e: any) {
    if (e?.code === 429) {
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }
});
