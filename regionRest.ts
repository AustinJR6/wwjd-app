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

const FALLBACK_REGIONS: RegionItem[] = [
  { id: 'midwest', name: 'Midwest' },
  { id: 'northeast', name: 'Northeast' },
  { id: 'northwest', name: 'Northwest' },
  { id: 'southeast', name: 'Southeast' },
  { id: 'southwest', name: 'Southwest' },
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
    if (!regionCache.length) {
      console.warn('⚠️ Empty region list from Firestore, using fallback');
      regionCache = FALLBACK_REGIONS;
    }
    return regionCache;
  } catch (err: any) {
    logFirestoreError('GET', 'regions', err);
    console.warn('Failed to fetch regions, using fallback', err.response?.data || err.message);
    regionCache = FALLBACK_REGIONS;
    return regionCache;
  }
}
