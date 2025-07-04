import axios from 'axios';
import { FIRESTORE_BASE } from './firebaseRest';
import { getIdToken } from './authRest';
import { logFirestoreError } from './App/lib/logging';

export interface RegionItem {
  id: string;
  name: string;
}

export async function fetchRegionList(): Promise<RegionItem[]> {
  const idToken = await getIdToken();
  const url = `${FIRESTORE_BASE}/regions`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const docs = res.data.documents || [];
    return docs.map((doc: any) => {
      const id = doc.name.split('/').pop() || '';
      const fields = doc.fields || {};
      const name = fields.name?.stringValue || 'Unnamed';
      return { id, name };
    });
  } catch (err: any) {
    logFirestoreError('GET', 'regions', err);
    throw new Error('Unable to fetch regions');
  }
}
