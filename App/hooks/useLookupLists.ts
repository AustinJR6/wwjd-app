import { useEffect, useState } from 'react';
import { fetchReligions, Religion, fetchRegions, Region } from '@/services/lookupService';
import { useAuth } from '@/hooks/useAuth';

const FALLBACK_REGION: Region = { id: 'unknown', name: 'Unknown' };

export function useLookupLists() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  const [religions, setReligions] = useState<Religion[] | null>(null);
  const [religionsLoading, setReligionsLoading] = useState(false);
  const [religionsError, setReligionsError] = useState<string | null>(null);

  const { user, initializing } = useAuth();

  useEffect(() => {
    if (initializing || !user) return;
    let mounted = true;
    (async () => {
      try {
        setRegionsLoading(true);
        const rgns = await fetchRegions();
        if (mounted) setRegions(rgns.length ? rgns : [FALLBACK_REGION]);
      } catch (err: any) {
        if (mounted) {
          console.warn('Failed to load regions', err);
          setRegions([FALLBACK_REGION]);
          setRegionsError(err?.message ?? 'Failed to load regions');
        }
      } finally {
        if (mounted) setRegionsLoading(false);
      }

      try {
        setReligionsLoading(true);
        const data = await fetchReligions();
        console.log('[lookups] religions loaded:', data.length, data.slice(0, 3));
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
