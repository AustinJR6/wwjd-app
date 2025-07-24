import { firestore } from '@/config/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { logFirestoreError } from './App/lib/logging';

export interface RegionItem {
  id: string;
  name: string;
}

let regionCache: RegionItem[] | null = null;

const REGION_IDS = [
  'midwest',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
];

export async function fetchRegionList(): Promise<RegionItem[]> {
  if (regionCache) {
    console.log('📦 Regions served from cache');
    return regionCache;
  }

  try {
    const snaps = await Promise.all(
      REGION_IDS.map((id) => getDoc(doc(firestore, 'regions', id))),
    );
    regionCache = snaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, name: s.data()?.name || 'Unnamed' }));
    return regionCache;
  } catch (err: any) {
    logFirestoreError('GET', 'regions', err);
    throw new Error('Unable to fetch regions');
  }
}
