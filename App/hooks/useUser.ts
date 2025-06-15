import { useUserStore } from '@/state/userStore';

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
  const user = useUserStore((state) => state.user as User | null);
  return { user, loading: false };
}

