import { useEffect, useState, useCallback } from 'react';
import {
  loadUserProfile,
  updateUserProfile,
  getCachedUserProfile,
} from '@/utils/userProfile';
import { useAuthStore } from '@/state/authStore';
import type { UserProfile } from '../../types';

export function useUserProfile() {
  const uid = useAuthStore((s) => s.uid);
  const [profile, setProfile] = useState<UserProfile | null>(getCachedUserProfile());
  const [loading, setLoading] = useState(!profile);

  const reload = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const data = await loadUserProfile(uid);
    setProfile(data);
    setLoading(false);
  }, [uid]);

  const update = useCallback(
    async (fields: Record<string, any>) => {
      if (!uid) return;
      await updateUserProfile(fields, uid);
      await reload();
    },
    [uid, reload],
  );

  useEffect(() => {
    if (!profile && uid) reload();
  }, [profile, uid, reload]);

  return { profile, loading, reload, update };
}
