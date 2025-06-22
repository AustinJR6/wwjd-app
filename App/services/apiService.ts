import axios from 'axios';
import { GEMINI_API_URL, STRIPE_API_URL } from '@/config/apiConfig';
import { getStoredToken } from './authService';

type AskGeminiResponse = {
  reply: string;
};

type StripeCheckoutResponse = {
  url: string;
};

export async function askGemini(prompt: string): Promise<string> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.error('🚫 Missing idToken for askGemini');
    throw new Error('Missing auth token');
  }
  try {
    const headers = {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };
    const res = await axios.post<AskGeminiResponse>(GEMINI_API_URL, { prompt }, { headers });
    return res.data.reply;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Gemini API error:', err);
    throw new Error('Failed to fetch Gemini response.');
  }
}

export async function createStripeCheckout(
  uid: string,
  options: { type: 'subscription' | 'one-time'; amount?: number }
): Promise<string> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.error('🚫 Missing idToken for createStripeCheckout');
    throw new Error('Missing auth token');
  }
  try {
    const headers = {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };
    const res = await axios.post<StripeCheckoutResponse>(STRIPE_API_URL, {
      uid,
      ...options,
    }, { headers });
    return res.data.url;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Stripe API error:', err);
    throw new Error('Unable to start checkout.');
  }
}

