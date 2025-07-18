import { signOutAndRetry, logTokenIssue } from '@/services/authLogger';
import { getIdToken } from '@/utils/authUtils';
import { showPermissionDenied } from '@/utils/gracefulError';
import { useAuthStore } from '@/state/authStore';
import Constants from 'expo-constants';

export const LOGGING_MODE =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_LOGGING_MODE || 'gusbug';

export async function sendRequestWithGusBugLogging<T>(
  requestFn: () => Promise<T>,
): Promise<T> {
  try {
    const res: any = await requestFn();

    const status = res?.status;
    const permError = res?.data?.error?.status === 'PERMISSION_DENIED';
    if (status === 401 || (status === 403 && !permError)) {
      const { uid } = useAuthStore.getState();
      console.warn('⚠️ Gus Bug Interception: Backend rejected the token.', {
        status,
        uid,
      });
      try {
        await getIdToken(true);
        return await requestFn();
      } catch (err) {
        logTokenIssue('gusBugRetry');
        await signOutAndRetry();
      }
    } else if (status === 403 && permError) {
      console.warn('Firestore 403 – not a session issue', res);
      showPermissionDenied();
    } else if (LOGGING_MODE === 'gusbug') {
      console.log('🎉 Gus Bug cleared the path. Request successful!');
    }

    return res;
  } catch (err: any) {
    const permError = err?.response?.data?.error?.status === 'PERMISSION_DENIED';
    if (err?.response?.status === 401 || (err?.response?.status === 403 && !permError)) {
      const { uid } = useAuthStore.getState();
      console.warn('⚠️ Gus Bug Interception: Backend rejected the token.', {
        status: err?.response?.status,
        uid,
      });
      try {
        await getIdToken(true);
        return await requestFn();
      } catch (e) {
        logTokenIssue('gusBugCatch');
        await signOutAndRetry();
      }
    } else if (err?.response?.status === 403 && permError) {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
    }
    throw err;
  }
}
