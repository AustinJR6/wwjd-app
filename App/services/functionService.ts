import { getStoredToken } from './authService';

const BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL;

export async function callFunction(name: string, data: any): Promise<any> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Function call without idToken');
    throw new Error('Missing auth token');
  }

  const url = `${BASE_URL}/${name}`;
  console.log('📡 Calling endpoint:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(data ?? {}),
    });

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
