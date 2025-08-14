import { create } from 'zustand';
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';
import { ensureAuth } from '@/utils/authGuard';
import type { UserProfile } from '../../types';
import { logProfileSync } from '@/lib/logProfileSync';

interface ProfileStore {
  profile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  refreshUserProfile: () => Promise<void>;
  validateProfileFields: () => Promise<void>;
}

export const useUserProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  setUserProfile: (profile) => {
    logProfileSync('set', profile);
    set({ profile });
  },
  refreshUserProfile: async () => {
    const uid = await ensureAuth();
    if (!uid) return;
    const data = await loadUserProfile(uid);
    if (data) {
      logProfileSync('refresh', data);
      set({ profile: data });
    }
  },
  validateProfileFields: async () => {
    const current = get().profile;
    const uid = await ensureAuth();
    if (!current || !uid) return;
    const updates: Partial<UserProfile> = {};
    if (!('religionId' in current) || !current.religionId) {
      updates.religionId = 'spiritual';
      updates.religion = 'spiritual';
    }
    if (current.profileComplete === undefined) {
      updates.profileComplete = false;
    }
    if (Object.keys(updates).length) {
      await updateUserProfile(updates, uid);
      set({ profile: { ...current, ...updates } as UserProfile });
      logProfileSync('patched', updates);
    }
  },
}));
