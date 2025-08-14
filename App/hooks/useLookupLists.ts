import { useEffect, useState } from 'react';
import { fetchRegionList, RegionItem } from '../../regionRest';
import { fetchReligions, Religion } from '@/services/lookupService';

const FALLBACK_REGION: RegionItem = { id: 'unknown', name: 'Unknown' };

export function useLookupLists() {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  const [religions, setReligions] = useState<Religion[]>([]);
  const [religionsLoading, setReligionsLoading] = useState(false);
  const [religionsError, setReligionsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadRegions = async () => {
      try {
        const rgns = await fetchRegionList();
        if (!isMounted) return;
        setRegions(rgns.length ? rgns : [FALLBACK_REGION]);
      } catch (err: any) {
        if (isMounted) {
          console.warn('Failed to load region list', err);
          setRegions([FALLBACK_REGION]);
          setRegionsError(err?.message ?? 'Failed to load regions');
        }
      } finally {
        if (isMounted) setRegionsLoading(false);
      }
    };
    loadRegions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setReligionsLoading(true);
        const list = await fetchReligions();
        if (mounted) setReligions(list);
      } catch (e: any) {
        if (mounted) setReligionsError(e?.message ?? 'Failed to load religions');
      } finally {
        if (mounted) setReligionsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loading = regionsLoading || religionsLoading;
  return {
    regions,
    regionsLoading,
    regionsError,
    religions,
    religionsLoading,
    religionsError,
    loading,
  };
}
