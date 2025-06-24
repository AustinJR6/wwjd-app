import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { GEMINI_API_URL } from '@/config/apiConfig';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export type GeminiMessage = { role: 'user' | 'assistant'; text: string };

export async function sendGeminiPrompt({
  prompt,
  history = [],
  url = GEMINI_API_URL,
}: {
  prompt: string;
  history?: GeminiMessage[];
  url?: string;
}): Promise<string> {
  let idToken: string | undefined;
  try {
    idToken = await firebase.auth().currentUser?.getIdToken();
    if (!idToken) throw new Error('No ID token');
  } catch (err) {
    console.error('Failed to get ID token', err);
    try {
      idToken = await firebase.auth().currentUser?.getIdToken(true);
    } catch (retryErr) {
      console.error('ID token retry failed', retryErr);
      throw retryErr;
    }
  }

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, history }),
      })
    );
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('🔥 Gemini parse error:', text);
      throw new Error('Invalid Gemini response');
    }
    return data.response || data.reply || '';
  } catch (err: any) {
    console.error('Gemini API error:', err);
    throw new Error('Gemini request failed');
  }
}
