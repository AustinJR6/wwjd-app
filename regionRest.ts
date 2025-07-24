import { getDocument } from '@/services/firestoreService';
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
      REGION_IDS.map((id) => getDocument(`regions/${id}`)),
    );
    regionCache = snaps
      .map((data, idx) => ({ id: REGION_IDS[idx], name: data?.name || 'Unnamed' }))
      .filter((r) => r.name);
    return regionCache;
  } catch (err: any) {
    logFirestoreError('GET', 'regions', err);
    throw new Error('Unable to fetch regions');
  }
}
