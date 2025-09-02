import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
// Use global fetch (Node 20 runtime)
import { embed, similarity } from '../vector';
import { EXTRACT_MEMORY_SYSTEM } from '../prompts/memory';
import type { UserMemory } from './models';
import { checkRateLimit } from './rateLimit';

const db = admin.firestore();

async function callLLMExtract(text: string): Promise<Array<{ type: string; text: string; importance: number; tags: string[] }>> {
  // Minimal OpenAI JSON extraction; fallback to heuristic if no key
  if (process.env.OPENAI_API_KEY) {
    const res = await (globalThis as any).fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_MEMORY_SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : parsed.items || [];
      return (arr as any[])
        .filter((x) => x && x.text && x.type)
        .slice(0, 3)
        .map((x) => ({
          type: String(x.type),
          text: String(x.text).slice(0, 160),
          importance: Math.max(1, Math.min(5, Number(x.importance) || 3)),
          tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 5) : [],
        }));
    } catch {
      return [];
    }
  }
  // No key: return empty (devs can wire later)
  return [];
}

export async function extractMemoriesFromText(uid: string, text: string, source: string): Promise<number> {
  const candidates = await callLLMExtract(text);
  if (!candidates.length) return 0;

  // Pull recent memories for novelty check (up to 200)
  const recentSnap = await db
    .collection(`users/${uid}/memories`)
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get();
  const recent = recentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const recentEmb: number[][] = recent.map((m) => (Array.isArray(m.embedding) ? (m.embedding as number[]) : []));

  let written = 0;
  for (const c of candidates) {
    if (!c.text || c.text.length < 8 || c.text.length > 300) continue;
    const emb = await embed(c.text);
    const embRounded = emb.map((v) => Math.round(v * 1000) / 1000);
    let maxCos = 0;
    for (const e of recentEmb) {
      if (!e?.length) continue;
      maxCos = Math.max(maxCos, similarity(emb, e));
      if (maxCos > 0.9) break;
    }
    if (maxCos > 0.9) continue; // skip duplicate

    const payload: UserMemory = {
      uid,
      type: (c.type as any) || 'fact',
      text: c.text,
      importance: c.importance,
      tags: c.tags || [],
      embedding: embRounded,
      novelty: maxCos,
      decayScore: 1.0,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection(`users/${uid}/memories`).add(payload as any);
    written++;
  }
  return written;
}

export const addMemoriesFromText = functions.https.onRequest(async (req, res) => {
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
    let { text, source = 'chat' } = body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text required' });
      return;
    }
    if (text.length > 2000) text = text.slice(0, 2000);
    const count = await extractMemoriesFromText(uid, text, source);
    if (count === 0) {
      res.status(202).json({ ok: true, written: 0 });
      return;
    }
    res.json({ ok: true, written: count });
  } catch (e: any) {
    if (e?.code === 429) {
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }
});
