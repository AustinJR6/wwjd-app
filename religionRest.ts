import { firestore } from '@/config/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
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
  try {
    const snap = await getDoc(doc(firestore, 'religion', id));
    if (!snap.exists()) {
      console.warn(`⚠️ Religion document missing: ${id}`);
      return {
        id,
        name: id,
        prompt: 'Respond with empathy, logic, and gentle spirituality.',
      };
    }
    const data = snap.data() || {};
    const profile: ReligionProfile = {
      id: snap.id,
      name: data.name || id,
      prompt:
        data.prompt ||
        'Respond with empathy, logic, and gentle spirituality.',
      aiVoice: data.aiVoice,
    };
    religionCache[id] = profile;
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

const RELIGION_IDS = [
  'SpiritGuide',
  'Christianity',
  'Islam',
  'Judaism',
  'Hinduism',
  'Buddhism',
  'Atheist',
  'Agnostic',
  'Pagan',
];

async function fetchReligionList(): Promise<ReligionItem[]> {
  try {
    const snaps = await Promise.all(
      RELIGION_IDS.map((id) => getDoc(doc(firestore, 'religion', id))),
    );
    const religions: ReligionItem[] = snaps
      .filter((s) => s.exists())
      .map((s) => {
        const data = s.data() || {};
        const name = data.name || s.id;
        return { id: s.id, name };
      });

    console.log('✅ Religions fetched', religions.map((r) => r.id));
    return religions;
  } catch (err: any) {
    logFirestoreError('GET', 'religion', err);
    throw new Error('Unable to fetch religions');
  }
}
