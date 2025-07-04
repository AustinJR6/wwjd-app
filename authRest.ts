import { getIdToken as getTokenFromAuth } from './App/lib/auth';

export async function getIdToken(forceRefresh = false): Promise<string> {
  const token = await getTokenFromAuth(forceRefresh);
  if (!token) {
    throw new Error('No ID token available');
  }
  return token;
}
