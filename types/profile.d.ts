export interface ReligionDocument {
  id: string;
  name?: string;
  aiVoice?: string;
  prompt?: string;
  defaultChallenges?: any[];
  language?: string;
  totalPoints?: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastUpdated: string;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  username?: string;
  region?: string;
  religion: string;
  points?: number;
  streak?: Streak;
  currentChallenge?: any;
  onboardingComplete?: boolean;
  [key: string]: any;
}

export interface CachedProfile extends UserProfile {
  religionData?: ReligionDocument | null;
}

export interface FirestoreUser extends UserProfile {
  email: string;
  isSubscribed: boolean;
  createdAt: number;
  challengeStreak?: { count: number; lastCompletedDate: string | null };
  dailyChallengeCount?: number;
  dailySkipCount?: number;
  lastChallengeLoadDate?: string | null;
  lastSkipDate?: string | null;
  organizationId?: string;
}
