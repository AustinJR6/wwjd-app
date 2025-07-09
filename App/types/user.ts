export interface DefaultUserData {
  uid: string;
  email: string;
  emailVerified?: boolean;
  displayName?: string;
  username?: string;
  region?: string;
  religion?: string;
  idToken?: string;

  // App-specific defaults
  createdAt: string;
  lastFreeAsk: string;
  lastFreeSkip: string;
  onboardingComplete: boolean;
  isSubscribed: boolean;
  individualPoints: number;
  tokens: number;
  skipTokensUsed: number;
  nightModeEnabled: boolean;
  organizationId: string | null;
  religionSlug: string;
}

export interface ChallengeHistoryEntry {
  date: string;
  completed: number;
  skipped: number;
}

// 🧠 This is what's loaded from Firestore or held in app state
export interface UserProfile extends DefaultUserData {
  dailyChallengeHistory?: ChallengeHistoryEntry;
}

// 🛠️ When patching/updating a user — all fields optional
export type UserDataPatch = Partial<Omit<DefaultUserData, 'uid'>>;

// 🧩 For onboarding form inputs
export interface UserOnboardingInput {
  displayName: string;
  username: string;
  region: string;
  religion: string;
}
