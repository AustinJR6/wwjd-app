import axios from 'axios';
import { GEMINI_API_URL, STRIPE_CHECKOUT_URL, DONATION_CHECKOUT_URL } from '@/config/apiConfig';
import { STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL } from '@/config/stripeConfig';
import { getAuthHeaders } from '@/config/firebaseApp';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

type AskGeminiResponse = {
  reply: string;
};

type StripeCheckoutResponse = {
  url: string;
};

export async function askGemini(
  prompt: string,
  history: { role: string; text: string }[] = [],
): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    console.error('🚫 Missing idToken for askGemini');
    throw new Error('Missing auth token');
  }
  try {
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<AskGeminiResponse>(GEMINI_API_URL, { prompt, history }, { headers })
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
  options: { type: 'subscription' | 'one-time'; priceId: string }
): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    console.error('🚫 Missing idToken for createStripeCheckout');
    throw new Error('Missing auth token');
  }
  try {
    const payload = {
      userId: uid,
      priceId: options.priceId,
      mode: options.type === 'subscription' ? 'subscription' : 'payment',
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
    };
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<StripeCheckoutResponse>(
        STRIPE_CHECKOUT_URL,
        payload,
        { headers },
      )
    );
    return res.data.url;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Stripe API error:', err.response?.data || err.message);
    throw new Error(err.response?.data?.error || 'Unable to start checkout.');
  }
}

export async function startDonationCheckout(
  uid: string,
  amount: number,
): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    console.error('🚫 Missing idToken for startDonationCheckout');
    throw new Error('Missing auth token');
  }
  try {
    const payload = { userId: uid, amount };
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<StripeCheckoutResponse>(DONATION_CHECKOUT_URL, payload, {
        headers,
      })
    );
    return res.data.url;
  } catch (err: any) {
    console.error('Stripe donation error:', err.response?.data || err.message);
    throw new Error(err.response?.data?.error || 'Unable to start donation.');
  }
}

