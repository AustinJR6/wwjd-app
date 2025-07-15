import apiClient from '@/utils/apiClient';
import { FIRESTORE_BASE } from './firebaseRest';
import { getIdToken } from './authRest';
import { logFirestoreError } from './App/lib/logging';

export interface ReligionItem {
  id: string;
  name: string;
}

export interface ReligionProfile extends ReligionItem {
  prompt?: string;
  aiVoice?: string;
}

let cachedReligions: ReligionItem[] | null = null;
const religionCache: Record<string, ReligionProfile> = {};

/**
 * Retrieve the list of religions, using an in-memory cache to avoid
 * unnecessary network calls within the app session.
 */
export async function getReligions(): Promise<ReligionItem[]> {
  if (cachedReligions) {
    console.log('📦 Religions served from cache');
    return cachedReligions;
  }

  try {
    const rels = await fetchReligionList();
    cachedReligions = rels;
    return rels;
  } catch (err) {
    console.error('getReligions failed', err);
    console.log('⚠️ Returning empty religion list');
    return [];
  }
}

export async function getReligionProfile(
  id: string,
): Promise<ReligionProfile | null> {
  if (religionCache[id]) {
    return religionCache[id];
  }
  const idToken = await getIdToken();
  const url = `${FIRESTORE_BASE}/religion/${id}`;
  console.log('➡️ Sending Firestore request to:', url);
  try {
    const res = await apiClient.get(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const fields = (res.data as any).fields || {};
    const profile: ReligionProfile = {
      id,
      name: fields.name?.stringValue || id,
      prompt:
        fields.prompt?.stringValue ||
        'Respond with empathy, logic, and gentle spirituality.',
      aiVoice: fields.aiVoice?.stringValue,
    };
    religionCache[id] = profile;
    console.log('✅ Firestore response:', res.status);
    return profile;
  } catch (err: any) {
    logFirestoreError('GET', `religion/${id}`, err);
    return null;
  }
}

export async function fetchReligionPrompt(id: string): Promise<{ prompt: string; aiVoice?: string } | null> {
  const profile = await getReligionProfile(id);
  if (!profile) return null;
  return { prompt: profile.prompt || '', aiVoice: profile.aiVoice };
}

async function fetchReligionList(): Promise<ReligionItem[]> {
  const idToken = await getIdToken();
  const url = `${FIRESTORE_BASE}/religion`;

  console.log('➡️ Fetching religions from', url);

  try {
    const response = await apiClient.get(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const docs = (response.data as any).documents || [];
    console.log('✅ Religions fetched', docs.map((d: any) => d.name.split('/').pop()));

    const religions: ReligionItem[] = docs.map((doc: any) => {
      const id = doc.name.split('/').pop() || '';
      const fields = doc.fields || {};
      const name = fields.name?.stringValue || id;
      return { id, name };
    });

    return religions;
  } catch (err: any) {
    logFirestoreError('GET', 'religion', err);
    throw new Error('Unable to fetch religions');
  }
}
