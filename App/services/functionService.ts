import { getStoredToken } from './authService';

const BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL;

export async function callFunction(name: string, data: any): Promise<any> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Function call without idToken');
    throw new Error('Missing auth token');
  }

  const res = await fetch(
    `${BASE_URL}/${name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(data ?? {}),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Function call failed');
  }

  return res.json();
}
