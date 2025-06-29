import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { sendSecureFirebaseRequest } from '@/utils/firebaseRequest';
import { FUNCTIONS_BASE_URL, getAuthHeader } from '@/config/firebaseApp';
import { logTokenIssue, getIdToken } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';

export async function callFunction(name: string, data: any): Promise<any> {
  let headers;
  try {
    headers = await getAuthHeader();
    console.log('Current user:', useAuthStore.getState().uid);
    const debugToken = await getIdToken();
    console.log('ID Token:', debugToken);
  } catch {
    await logTokenIssue('function call', false);
    throw new Error('Missing auth token');
  }

  const url = `${FUNCTIONS_BASE_URL}/${name}`;
  console.log('📡 Calling endpoint:', url);
  try {
    const res = await sendRequestWithGusBugLogging(() => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data ?? {}),
    }));

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Function call failed');
    }

    return res.json();
  } catch (err: any) {
    console.error('🔥 Backend error:', err?.response?.data || err.message);
    throw err;
  }
}

export async function incrementReligionPoints(
  religion: string,
  points: number,
): Promise<void> {
  const url = `${FUNCTIONS_BASE_URL}/incrementReligionPoints`;
  console.log('📡 Calling endpoint:', url);
  try {
    await sendRequestWithGusBugLogging(() =>
      sendSecureFirebaseRequest(url, { religion, points })
    );
  } catch (err: any) {
    console.error('🔥 Backend error:', err?.response?.data || err.message);
    throw err;
  }
}

export async function createMultiDayChallenge(prompt: string, days: number) {
  return await callFunction('createMultiDayChallenge', { prompt, days });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
