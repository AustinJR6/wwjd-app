import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./RootStackParamList";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function resetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Auth', params: { screen: 'Login' } }],
    });
  }
}
