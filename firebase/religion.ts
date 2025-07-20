import axios from 'axios';
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

  const token = await getIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/wwjd-app/databases/(default)/documents/religion`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const docs = (res.data as any).documents || [];

    religionsCache = docs.map((doc: any) => ({
      id: doc.name.split('/').pop(),
      name: doc.fields.name?.stringValue ?? '',
      aiVoice: doc.fields.aiVoice?.stringValue ?? '',
      defaultChallenges:
        doc.fields.defaultChallenges?.arrayValue?.values?.map((v: any) => v.stringValue) ?? [],
      totalPoints: Number(doc.fields.totalPoints?.integerValue ?? 0),
      language: doc.fields.language?.stringValue ?? '',
    }));

    console.log('📖 Religions fetched:', religionsCache.map((r) => r.name));
    return religionsCache;
  } catch (err: any) {
    console.error('🔥 Failed to fetch religions:', err.response?.data || err);
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
