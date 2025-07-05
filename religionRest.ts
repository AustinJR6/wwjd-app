import axios from 'axios';
import { FIRESTORE_BASE } from './firebaseRest';
import { getIdToken } from './authRest';
import { logFirestoreError } from './App/lib/logging';

export interface ReligionItem {
  id: string;
  name: string;
}

export async function fetchReligionList(): Promise<ReligionItem[]> {
  const idToken = await getIdToken();
  const url = `${FIRESTORE_BASE}/religion`;

  console.log('➡️ Fetching religions from', url);

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const docs = response.data.documents || [];
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
