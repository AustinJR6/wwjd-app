import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { checkRateLimit } from './memory/rateLimit';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';

export type EmbedProvider = 'openai' | 'stub';

export function getEmbeddingConfig(): { provider: EmbedProvider; model: string; dims: number } {
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', model: 'text-embedding-3-small', dims: 1536 };
  }
  // Fallback stub for local/dev without keys
  return { provider: 'stub', model: 'stub-embed-512', dims: 512 };
}

export async function embed(text: string): Promise<number[]> {
  const { provider, model, dims } = getEmbeddingConfig();
  if (provider === 'openai') {
    const res = await (globalThis as any).fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`OpenAI embed failed: ${res.status} ${msg}`);
    }
    const data = (await res.json()) as any;
    return (data?.data?.[0]?.embedding as number[]) || [];
  }
  // Deterministic stub embedding: simple hashed features
  const out = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = code % dims;
    out[idx] += 1;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

export function similarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

export const vectorCheck = functions.https.onRequest(async (req, res) => {
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
    res.status(200).json({ message: 'Request successful' });
  } catch (e: any) {
    if (e?.code === 429) {
      res.status(429).json({ error: 'Too Many Requests' });
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
});
