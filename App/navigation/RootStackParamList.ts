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

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MainTabsParamList } from './MainTabsParamList';

export type RootStackParamList = {
  // Root navigators
  Auth: undefined;
  // MainTabs accepts nested navigation params for the bottom tab navigator
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;

  // Auth stack screens
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ForgotUsername: undefined;
  OrganizationSignup: undefined;
  ProfileCompletion: undefined;

  // Main app screens
  HomeScreen: undefined;
  ReligionAI: undefined;
  Journal: undefined;
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
  ChangePassword: undefined;
  Settings: undefined;
  AppInfo: undefined;

  // Shared flow screens
  Quote: undefined;
  SelectReligion: undefined;
};
