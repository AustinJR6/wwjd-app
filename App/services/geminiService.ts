import { GEMINI_API_URL } from '@/config/apiConfig';
import { getAuthHeader } from '@/config/firebaseApp';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { useAuthStore } from '@/state/authStore';
import { getIdToken } from '@/services/authService';

export type GeminiMessage = { role: 'user' | 'assistant'; text: string };

export async function sendGeminiPrompt({
  prompt,
  history = [],
  url = GEMINI_API_URL,
  onResponse,
  onError,
}: {
  prompt: string;
  history?: GeminiMessage[];
  url?: string;
  onResponse?: (reply: string) => void;
  onError?: (err: any) => void;
}): Promise<string | null> {
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeader();
    console.log('Current user:', useAuthStore.getState().uid);
    const debugToken = await getIdToken();
    console.log('ID Token:', debugToken);
  } catch (err) {
    console.warn('No authenticated user for Gemini request');
    console.error('❌ Gemini token retrieval failed:', err);
    onError?.(err instanceof Error ? err : new Error('No authenticated user'));
    return null;
  }

  headers = { ...headers, 'Content-Type': 'application/json' };

  const formattedHistory = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  if (!prompt) {
    console.warn('⚠️ Empty Gemini prompt');
  }

  try {
    console.log('➡️ Gemini request to', url);
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, history: formattedHistory }),
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
