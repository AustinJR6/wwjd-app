import { getIdToken } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';

export const firebase = {
  auth() {
    return {
      currentUser: {
        uid: useAuthStore.getState().uid || '',
        async getIdToken(forceRefresh = true) {
          return getIdToken(forceRefresh);
        },
      },
    };
  },
};
