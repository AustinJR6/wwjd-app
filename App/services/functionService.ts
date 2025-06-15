import { getStoredToken } from './authService';

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const REGION = process.env.EXPO_PUBLIC_FIREBASE_REGION || 'us-central1';

export async function callFunction(name: string, data: any): Promise<any> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Function call without idToken');
    throw new Error('Missing auth token');
  }

  const res = await fetch(
    `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`,
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
