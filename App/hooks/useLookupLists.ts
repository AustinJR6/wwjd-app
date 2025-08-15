import { useEffect, useState } from 'react';
import { fetchRegionList, RegionItem } from '../../regionRest';
import { fetchReligions, Religion } from '@/services/lookupService';
import { useAuth } from '@/hooks/useAuth';

const FALLBACK_REGION: RegionItem = { id: 'unknown', name: 'Unknown' };

export function useLookupLists() {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  const [religions, setReligions] = useState<Religion[] | null>(null);
  const [religionsLoading, setReligionsLoading] = useState(false);
  const [religionsError, setReligionsError] = useState<string | null>(null);

  const { user, initializing } = useAuth();

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
    if (initializing || !user) return;
    let mounted = true;
    (async () => {
      try {
        setReligionsLoading(true);
        const data = await fetchReligions();
        if (mounted) setReligions(data);
      } catch (e: any) {
        if (mounted)
          setReligionsError(
            e?.response?.data?.error?.message || e?.message || 'Failed to load religions'
          );
      } finally {
        if (mounted) setReligionsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initializing, user]);

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
