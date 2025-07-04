/**
 * Represents a user stored in Firestore
 */
export interface FirestoreUser {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  religion: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  createdAt: number;
  challengeStreak?: {
    count: number;
    lastCompletedDate: string | null;
  };
  dailyChallengeCount?: number;
  dailySkipCount?: number;
  lastChallengeLoadDate?: string | null;
  lastSkipDate?: string | null;
}

/**
 * Represents a user in local app state (via Zustand)
 */
export interface AppUser {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  religion: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  tokens: number;
}
