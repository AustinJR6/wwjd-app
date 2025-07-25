import { useUserProfileStore } from "@/state/userProfile";

export interface User {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
  religion: string;
  region: string;
  organizationId?: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  profileComplete: boolean;
  profileSchemaVersion?: number;
  lastActive?: string;
  tokens: number;
}

export function useUser(): { user: User | null; loading: boolean } {
  const user = useUserProfileStore((state) => state.profile as User | null);
  return { user, loading: false };
}
