// firebase/religion.ts
// Backwards-compatible wrapper over unified Firestore REST helper.
// Keeps existing imports working while routing through listReligions().

import { listReligions } from '../functions/lib/firestoreRest';

export interface ReligionItem {
  id: string;
  name: string;
  aiVoice?: string;
  defaultChallenges: string[];
  language?: string;
  totalPoints?: number;
  userCount?: number;
}

let religionsCache: ReligionItem[] = [];

export async function getReligions(forceRefresh = false): Promise<ReligionItem[]> {
  if (!forceRefresh && religionsCache.length) return religionsCache;

  try {
    const rows = await listReligions();
    const mapped: ReligionItem[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      aiVoice: r.aiVoice,
      defaultChallenges: Array.isArray(r.defaultChallenges) ? r.defaultChallenges : [],
      language: r.language,
      totalPoints: typeof r.totalPoints === 'number' ? r.totalPoints : 0,
      userCount: typeof r.userCount === 'number' ? r.userCount : 0,
    }));

    religionsCache = mapped.length
      ? mapped
      : [{ id: 'spiritual', name: 'Spiritual', defaultChallenges: [] as string[] }];

    if (__DEV__) console.debug('[religion] wrapper loaded', religionsCache.length);
    return religionsCache;
  } catch {
    console.warn('[religion] wrapper failed, using fallback');
    return [{ id: 'spiritual', name: 'Spiritual', defaultChallenges: [] }];
  }
}
