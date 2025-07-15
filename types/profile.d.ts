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
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
  religion: string;
  points?: number;
  tokens?: number;
  streak?: Streak;
  isSubscribed?: boolean;
  currentChallenge?: any;
  onboardingComplete?: boolean;
  lastChallenge?: Date;
  lastChallengeText?: string;
  dailySkipCount?: number;
  lastSkipDate?: string | null;
  dailyChallengeHistory?: {
    date: string;
    completed: number;
    skipped: number;
  };
  streakMilestones?: Record<string, boolean>;
  createdAt?: number;
  /** Tokens spent on skipping challenges */
  skipTokensUsed?: number;
  /** Dark mode preference */
  nightModeEnabled?: boolean;
  profileComplete?: boolean;
  profileSchemaVersion?: number;
  lastActive?: string;
  /** Optional custom prefix for AI prompts */
  religionPrefix?: string;
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
  /** Tokens spent on skipping challenges */
  skipTokensUsed: number;
  /** Dark mode preference */
  nightModeEnabled: boolean;
  profileComplete: boolean;
  profileSchemaVersion: number;
  lastActive?: string;
  /** Optional custom prefix for AI prompts */
  religionPrefix?: string;
  organizationId?: string;
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
}
