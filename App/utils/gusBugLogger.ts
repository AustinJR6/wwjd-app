export const LOGGING_MODE = process.env.EXPO_PUBLIC_LOGGING_MODE || 'gusbug';

export async function sendRequestWithGusBugLogging<T>(
  requestFn: () => Promise<T>,
): Promise<T> {
  try {
    const res: any = await requestFn();

    const status = res?.status;
    if (status === 401 || status === 403) {
      if (LOGGING_MODE === 'gusbug') {
        console.warn('⚠️ Gus Bug Interception: Backend rejected the token. 🧸🕵️');
      } else {
        console.warn('Request failed with auth error');
      }
    } else if (LOGGING_MODE === 'gusbug') {
      console.log('🎉 Gus Bug cleared the path. Request successful!');
    }

    return res;
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      if (LOGGING_MODE === 'gusbug') {
        console.warn('⚠️ Gus Bug Interception: Backend rejected the token. 🧸🕵️');
      } else {
        console.warn('Request failed with auth error');
      }
    }
    throw err;
  }
}
