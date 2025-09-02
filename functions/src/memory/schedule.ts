import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
// Use global fetch (Node 20)

const db = admin.firestore();

async function summarizeText(text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return text.slice(0, 1000);
  const res = await (globalThis as any).fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Summarize the conversation in <= 250 words, focusing on goals, struggles, wins, tone preferences, and follow-ups. Neutral tone.' },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || text.slice(0, 1000);
}

export const summarizeRecentSessions = functions
  .region('us-central1')
  .pubsub.schedule('0 3 * * *')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const users = await db.collection('users').limit(50).get();
    for (const doc of users.docs) {
      const uid = doc.id;
      const idxRef = db.doc(`users/${uid}/memory_index/current`);
      const idxSnap = await idxRef.get();
      const last = idxSnap.exists ? (idxSnap.data() as any)?.lastSummarizedAt : null;

      const msgs = await db
        .collection(`religionChats/${uid}/messages`)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()
        .catch(() => ({ docs: [] } as any));
      if (!msgs.docs.length) continue;
      const spanEnd = msgs.docs[0].get('timestamp') || new Date().toISOString();
      const spanStart = msgs.docs[msgs.docs.length - 1].get('timestamp') || new Date().toISOString();
      const text = msgs.docs
        .map((d: any) => `${d.get('role') || 'user'}: ${d.get('text') || ''}`)
        .reverse()
        .join('\n');
      const summary = await summarizeText(text);
      await db.collection(`users/${uid}/session_summaries`).add({
        text: summary,
        spanStart,
        spanEnd,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await idxRef.set({ lastSummarizedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    return null;
  });

export const decayMemories = functions
  .region('us-central1')
  .pubsub.schedule('0 2 * * *')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const users = await db.collection('users').limit(50).get();
    for (const u of users.docs) {
      const uid = u.id;
      const mems = await db.collection(`users/${uid}/memories`).limit(500).get();
      const batch = db.batch();
      mems.docs.forEach((m) => {
        const data = m.data();
        if (data?.pinned) return; // skip pinned
        const dec = Math.min(1.2, Math.max(0, (data.decayScore || 1.0) * 0.97));
        batch.update(m.ref, { decayScore: dec });
      });
      await batch.commit();
    }
    return null;
  });
