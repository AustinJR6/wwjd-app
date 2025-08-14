import { useEffect, useState } from 'react';
import { fetchRegionList, RegionItem } from '../../regionRest';

const FALLBACK_REGION: RegionItem = { id: 'unknown', name: 'Unknown' };

export function useLookupLists() {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const rgns = await fetchRegionList();
        if (!isMounted) return;
        setRegions(rgns.length ? rgns : [FALLBACK_REGION]);
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load region list', err);
          setRegions([FALLBACK_REGION]);
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

  return { regions, loading };
}
