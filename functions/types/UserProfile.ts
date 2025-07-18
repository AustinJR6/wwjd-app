export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  createdAt: any;
  lastActive: any;
  lastFreeAsk: any;
  lastFreeSkip: any;
  onboardingComplete: boolean;
  religion: string;
  tokens: number;
  skipTokensUsed: number;
  individualPoints: number;
  isSubscribed: boolean;
  nightModeEnabled: boolean;
  preferredName: string | null;
  pronouns: string | null;
  avatarURL: string | null;
  profileComplete: boolean;
  profileSchemaVersion: string;
  challengeStreak: { count: number; lastCompletedDate: any };
  dailyChallengeCount: number;
  dailySkipCount: number;
  lastChallengeLoadDate: any;
  lastSkipDate: any;
}
