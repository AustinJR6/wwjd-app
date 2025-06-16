import { useUserDataStore } from '@/state/userDataStore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  religion: string;
  region: string;
  organizationId?: string;
  isSubscribed: boolean;
  tokens: number;
}

export function useUser(): { user: User | null; loading: boolean } {
  const { userProfile, tokenCount, isSubscribed, loading } = useUserDataStore();
  const user = userProfile
    ? { ...userProfile, isSubscribed, tokens: tokenCount } as User
    : null;
  return { user, loading };
}
