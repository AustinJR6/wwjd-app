import { Alert } from 'react-native';
import { useAuthStore } from '@/state/authStore';
import { resetToLogin } from '@/navigation/navigationRef';
import { logout } from './authService';

export function logTokenIssue(context: string) {
  const { uid } = useAuthStore.getState();
  console.warn(`🔐 Token issue during ${context}`, { uid });
}

export async function signOutAndRetry(): Promise<void> {
  console.warn('🚪 Auth failure detected');
  Alert.alert('Session expired', 'Please sign in again.');
  await logout();
  resetToLogin();
}
