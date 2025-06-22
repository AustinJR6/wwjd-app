import axios from 'axios';
import {
  GEMINI_API_URL,
  STRIPE_SUB_CHECKOUT_URL,
  STRIPE_TOKEN_CHECKOUT_URL,
} from '@/config/apiConfig';
import { getStoredToken } from './authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

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
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<AskGeminiResponse>(GEMINI_API_URL, { prompt }, { headers })
    );
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
    const endpoint =
      options.type === 'subscription'
        ? STRIPE_SUB_CHECKOUT_URL
        : STRIPE_TOKEN_CHECKOUT_URL;
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<StripeCheckoutResponse>(
        endpoint,
        {
          uid,
          ...options,
        },
        { headers },
      )
    );
    return res.data.url;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Stripe API error:', err);
    throw new Error('Unable to start checkout.');
  }
}

