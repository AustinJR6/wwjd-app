import { FIREBASE_WEB_API_KEY } from '../config/env';

const BASE = 'https://identitytoolkit.googleapis.com/v1';

export function withKey(path: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE}${path}${sep}key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;
}

export interface AuthResponse {
  idToken: string;
  refreshToken: string;
  localId: string;
  email?: string;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (!FIREBASE_WEB_API_KEY) throw new Error('Missing Firebase Web API key');
  const url = withKey('/accounts:signUp');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? 'SIGNUP_FAILED';
    throw new Error(`SIGNUP_FAILED:${msg}`);
  }
  return json as AuthResponse;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (!FIREBASE_WEB_API_KEY) throw new Error('Missing Firebase Web API key');
  const url = withKey('/accounts:signInWithPassword');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? 'LOGIN_FAILED';
    throw new Error(`LOGIN_FAILED:${msg}`);
  }
  return json as AuthResponse;
}
