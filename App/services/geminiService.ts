import { GEMINI_API_URL } from '@/config/apiConfig';
import { getFreshIdToken } from '@/services/authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

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
  let idToken: string | null;
  try {
    idToken = await getFreshIdToken();
    if (!idToken) throw new Error('No authenticated user');
  } catch (err) {
    console.warn('No authenticated user for Gemini request');
    onError?.(err instanceof Error ? err : new Error('No authenticated user'));
    return null;
  }

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  const formattedHistory = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, history: formattedHistory }),
      })
    );
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('🔥 Gemini parse error:', text);
      onError?.(new Error('Invalid Gemini response'));
      return null;
    }
    const reply = data.response || data.reply || '';
    onResponse?.(reply);
    return reply;
  } catch (err: any) {
    console.error('Gemini API error:', err);
    onError?.(err);
    return null;
  }
}
