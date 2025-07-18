import { Alert } from 'react-native';
import { resetToLogin } from '@/navigation/navigationRef';
import { performLogout } from '@/shared/logout';

export async function signOutAndRetry(): Promise<void> {
  console.warn('🚪 Auth failure detected');
  Alert.alert('Session expired', 'Please sign in again.');
  await performLogout();
  resetToLogin();
}
