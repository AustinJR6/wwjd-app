import { useEffect, useState } from 'react';
import { fetchRegionList, RegionItem } from '../../regionRest';
import { getReligions, ReligionItem } from '../../religionRest';

const FALLBACK_REGION: RegionItem = { id: 'unknown', name: 'Unknown' };
const FALLBACK_RELIGION: ReligionItem = { id: 'spiritual', name: 'Spiritual Guide' };

export function useLookupLists() {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [religions, setReligions] = useState<ReligionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      console.log('⏬ Loading region and religion lists');
      try {
        const [rgns, rels] = await Promise.all([
          fetchRegionList(),
          getReligions(),
        ]);
        if (!isMounted) return;
        console.log('📖 Fetched regions', rgns);
        console.log('📖 Fetched religions', rels);
        setRegions(rgns.length ? rgns : [FALLBACK_REGION]);
        setReligions(rels.length ? rels : [FALLBACK_RELIGION]);
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load reference lists', err);
          setRegions([FALLBACK_REGION]);
          setReligions([FALLBACK_RELIGION]);
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
  }, []);

  return { regions, religions, loading };
}
