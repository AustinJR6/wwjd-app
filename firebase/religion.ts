import axios from 'axios';
import { getIdToken } from '../authRest';
import Constants from 'expo-constants';

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
  try {
    const token = await getIdToken();
    const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/religion`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    const docs = (res.data?.documents || []) as any[];
    religionsCache = docs.map((d: any) => {
      const fields = d.fields || {};
      const name = fields?.name?.stringValue || '';
      const path = (d.name as string) || '';
      const id = path.split('/').pop() || name || '';
      return {
        id,
        name: name || id,
        aiVoice: fields?.aiVoice?.stringValue || '',
        defaultChallenges: Array.isArray(fields?.defaultChallenges?.arrayValue?.values)
          ? fields.defaultChallenges.arrayValue.values.map((v: any) => v.stringValue).filter(Boolean)
          : [],
        totalPoints: parseInt(fields?.totalPoints?.integerValue || '0', 10) || 0,
        language: fields?.language?.stringValue || '',
      } as ReligionItem;
    });
    return religionsCache;
  } catch (err: any) {
    console.error('Failed to fetch religions:', err?.response?.data || err);
    return [];
  }
}

export async function updateReligionPoints(religionId: string, pointsToAdd: number) {
  const token = await getIdToken();
  const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
  const docPath = `projects/${projectId}/databases/(default)/documents/religion/${religionId}`;

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

    return true;
  } catch (err: any) {
    console.error('Failed to update religion points:', err?.response?.data || err);
    return false;
  }
}

