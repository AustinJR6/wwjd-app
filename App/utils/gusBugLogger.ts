import { signOutAndRetry, checkAndRefreshIdToken, logTokenIssue } from '@/services/authService';
import { showPermissionDenied } from '@/utils/gracefulError';

export const LOGGING_MODE = process.env.EXPO_PUBLIC_LOGGING_MODE || 'gusbug';

export async function sendRequestWithGusBugLogging<T>(
  requestFn: () => Promise<T>,
): Promise<T> {
  try {
    const res: any = await requestFn();

    const status = res?.status;
    const permError = res?.data?.error?.status === 'PERMISSION_DENIED';
    if (status === 401 || (status === 403 && !permError)) {
      if (LOGGING_MODE === 'gusbug') {
        console.warn('⚠️ Gus Bug Interception: Backend rejected the token. 🧸🕵️');
      } else {
        console.warn('Request failed with auth error');
      }
      try {
        await checkAndRefreshIdToken();
        return await requestFn();
      } catch (err) {
        await logTokenIssue('gusBugRetry', true);
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
      if (LOGGING_MODE === 'gusbug') {
        console.warn('⚠️ Gus Bug Interception: Backend rejected the token. 🧸🕵️');
      } else {
        console.warn('Request failed with auth error');
      }
      try {
        await checkAndRefreshIdToken();
        return await requestFn();
      } catch (e) {
        await logTokenIssue('gusBugCatch', true);
        await signOutAndRetry();
      }
    } else if (err?.response?.status === 403 && permError) {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
    }
    throw err;
  }
}
