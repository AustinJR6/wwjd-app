import { endpoints } from './endpoints';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { useAuthStore } from '@/state/authStore';
import { getIdToken } from '@/utils/authUtils';
import { useUserStore } from '@/state/userStore';

export type GeminiMessage = { role: 'user' | 'assistant'; text: string };

export async function sendGeminiPrompt({
  prompt,
  history = [],
  url = endpoints.askGeminiV2,
  token,
  religion,
  onResponse,
  onError,
}: {
  prompt: string;
  history?: GeminiMessage[];
  url?: string;
  token?: string;
  religion?: string;
  onResponse?: (reply: string) => void;
  onError?: (err: any) => void;
}): Promise<string | null> {
  let headers: Record<string, string>;
  try {
    const idToken = token || (await getIdToken(true));
    if (!idToken) throw new Error('No token');
    headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
    console.log('Current user:', useAuthStore.getState().uid);
    console.log('ID Token:', idToken);
  } catch (err) {
    console.warn('No authenticated user for Gemini request');
    console.error('❌ Gemini token retrieval failed:', err);
    onError?.(err instanceof Error ? err : new Error('No authenticated user'));
    return null;
  }

  const formattedHistory = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  if (!prompt) {
    console.warn('⚠️ Empty Gemini prompt');
  }

  try {
    console.log('➡️ Gemini request to', url);
    const finalReligion = religion ?? useUserStore.getState().user?.religion;
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, history: formattedHistory, religion: finalReligion }),
      })
    );

    const text = await res.text();

    if (!res.ok) {
      console.error(`❌ Gemini endpoint error ${res.status} for ${url}`);
      console.log('🔻 Gemini error body:', text);
      onError?.(new Error(`Gemini error ${res.status}`));
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('🔥 Gemini parse error:', text);
      onError?.(new Error('Invalid Gemini response'));
      return null;
    }
    const reply = data.response || data.reply || '';
    if (!reply) {
      console.warn('⚠️ Empty Gemini reply returned');
    }
    onResponse?.(reply);
    return reply;
  } catch (err: any) {
    console.error('Gemini API error:', err);
    onError?.(err);
    return null;
  }
}
