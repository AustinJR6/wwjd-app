import { useEffect, useState } from 'react';
import { fetchRegionList, RegionItem } from '../../regionRest';
import { listReligions, Religion } from '../../functions/lib/firestoreRest';

const FALLBACK_REGION: RegionItem = { id: 'unknown', name: 'Unknown' };
const FALLBACK_RELIGION: Religion = { id: 'spiritual', name: 'Spiritual' };

export function useLookupLists(opts?: { includeReligions?: boolean }) {
  const includeReligions = opts?.includeReligions !== false;
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      console.log('⏬ Loading region and religion lists');
      try {
        const regionPromise = fetchRegionList();
        const religionPromise = includeReligions ? listReligions() : Promise.resolve<Religion[]>([]);
        const [rgns, rels] = await Promise.all([regionPromise, religionPromise]);
        if (!isMounted) return;
        console.log('📖 Fetched regions', rgns);
        if (includeReligions) console.log('📖 Fetched religions', rels);
        setRegions(rgns.length ? rgns : [FALLBACK_REGION]);
        if (includeReligions) setReligions(rels.length ? rels : [FALLBACK_RELIGION]);
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load reference lists', err);
          setRegions([FALLBACK_REGION]);
          if (includeReligions) setReligions([FALLBACK_RELIGION]);
          console.log('🕳️ Using fallback reference lists');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [includeReligions]);

  return { regions, religions, loading };
}
