import axios from 'axios';
import { getDocument } from '@/services/firestoreService';
import { getIdToken } from '../authRest';

export interface ReligionItem {
  id: string;
  name: string;
  aiVoice: string;
  defaultChallenges: string[];
  totalPoints: number;
  language: string;
}

let religionsCache: ReligionItem[] = [];

export async function getReligions(forceRefresh = false): Promise<ReligionItem[]> {
  if (!forceRefresh && religionsCache.length) return religionsCache;

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

  try {
    const snaps = await Promise.all(
      RELIGION_IDS.map((id) => getDocument(`religion/${id}`)),
    );
    religionsCache = snaps.map((data, idx) => ({
      id: RELIGION_IDS[idx],
      name: data?.name ?? RELIGION_IDS[idx],
      aiVoice: data?.aiVoice ?? '',
      defaultChallenges: Array.isArray(data?.defaultChallenges)
        ? data.defaultChallenges
        : [],
      totalPoints: Number(data?.totalPoints ?? 0),
      language: data?.language ?? '',
    } as ReligionItem));

    console.log('📖 Religions fetched:', religionsCache.map((r) => r.name));
    return religionsCache;
  } catch (err: any) {
    console.error('🔥 Failed to fetch religions:', err);
    return [];
  }
}

export async function updateReligionPoints(religionId: string, pointsToAdd: number) {
  const token = await getIdToken();
  const docPath = `projects/wwjd-app/databases/(default)/documents/religion/${religionId}`;

  const current = religionsCache?.find((r) => r.id === religionId)?.totalPoints ?? 0;
  const newTotal = current + pointsToAdd;

  try {
    await axios.patch(
      `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=totalPoints`,
      {
        fields: {
          totalPoints: { integerValue: newTotal.toString() },
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`✅ Religion ${religionId} updated with totalPoints = ${newTotal}`);
    return true;
  } catch (err: any) {
    console.error('🔥 Failed to update religion points:', err.response?.data || err);
    return false;
  }
}
