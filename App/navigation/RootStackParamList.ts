// RootStackParamList.ts

// This declares a global namespace for React Navigation.
// By extending `ReactNavigation.RootParamList`, you tell TypeScript
// that your `RootStackParamList` defines the complete set of routes
// for your application's root navigator.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export type RootStackParamList = {
  // Auth stack screens
  Login: undefined;
  Signup: undefined;
  Onboarding: undefined;
  OrganizationSignup: undefined;

  // Main app screens
  Home: undefined;
  WWJD: undefined;
  Journal: undefined;
  Streak: undefined;
  Challenge: undefined;
  Confessional: undefined;
  BuyTokens: undefined;
  Upgrade: undefined;
  GiveBack: undefined;
  Trivia: undefined;
  Leaderboards: undefined;
  SubmitProof: undefined;
  JoinOrganization: undefined;
  OrganizationManagement: undefined;
  Profile: undefined;
  Settings: undefined;

  // Shared flow screens
  Quote: undefined;
  SelectReligion: undefined;
};
