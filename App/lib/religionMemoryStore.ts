import { queryCollection, getDocument, setDocument } from '@/services/firestoreService';
import type { ReligionMemory, ChatMessage } from '@/types/religion';
import { queryUserSub, parseRunQueryRows } from '@/services/firestoreService';

const colPath = (uid: string) => `users/${uid}/religionChats`;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

export async function saveReligionMemory(
  uid: string,
  payload: { title: string; messages: ChatMessage[]; summary?: string },
) {
  const now = Date.now();
  const base = slugify(payload.title || 'memory');
  const id = base ? `${base}-${now}` : String(now);
  await setDocument(`${colPath(uid)}/${id}`, {
    title: payload.title,
    messages: payload.messages,
    summary: payload.summary ?? '',
    createdAt: now,
    updatedAt: now,
    _sv: new Date(),
  });
}

export async function listReligionMemories(uid: string, opts?: { limitTo?: number }) {
  const rows = await queryCollection(colPath(uid), {
    orderByField: 'createdAt',
    direction: 'DESCENDING',
    limit: opts?.limitTo ?? 50,
  });
  return rows as ReligionMemory[];
}

export async function searchReligionMemories(uid: string, term: string) {
  if (!term) return listReligionMemories(uid);
  const recent = await listReligionMemories(uid, { limitTo: 100 });
  const t = term.toLowerCase();
  return recent.filter(
    (m: any) => (m.title ?? '').toLowerCase().includes(t) || (m.summary ?? '').toLowerCase().includes(t),
  ) as ReligionMemory[];
}

export async function getReligionMemory(uid: string, id: string) {
  const path = `${colPath(uid)}/${id}`;
  const data = await getDocument(path);
  return data ? ({ id, ...(data as any) } as ReligionMemory) : null;
}

// REST-based listing using documents:runQuery scoped by parent
export async function listReligionMemoriesREST(uid: string, limitTo: number = 50): Promise<ReligionMemory[]> {
  const rows = await queryUserSub(uid, 'religionChats', {
    orderBy: [{ fieldPath: 'createdAt', direction: 'DESCENDING' }],
    limit: limitTo,
  });
  return parseRunQueryRows(rows) as ReligionMemory[];
}

export async function searchReligionMemoriesLocal(items: ReligionMemory[], term: string) {
  if (!term) return items;
  const t = term.toLowerCase();
  return items.filter((m) => (m.title ?? '').toLowerCase().includes(t) || (m.summary ?? '').toLowerCase().includes(t));
}
