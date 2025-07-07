export interface ReligionDocument {
  id: string;
  name?: string;
  aiVoice?: string;
  prompt?: string;
  defaultChallenges?: any[];
  language?: string;
  totalPoints?: number;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  username?: string;
  region?: string;
  religion: string;
  points?: number;
  streak?: number;
  currentChallenge?: any;
  onboardingComplete?: boolean;
  [key: string]: any;
}

export interface CachedProfile extends UserProfile {
  religionData?: ReligionDocument | null;
}
