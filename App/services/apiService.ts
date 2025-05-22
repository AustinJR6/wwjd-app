import axios from 'axios';
import { GEMINI_API_URL, STRIPE_API_URL } from '../config/apiConfig';

type AskGeminiResponse = {
  reply: string;
};

type StripeCheckoutResponse = {
  checkoutUrl: string;
};

export async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await axios.post<AskGeminiResponse>(GEMINI_API_URL, { prompt });
    return res.data.reply;
  } catch (err: any) {
    console.error('Gemini API error:', err);
    throw new Error('Failed to fetch Gemini response.');
  }
}

export async function createStripeCheckout(userId: string): Promise<string> {
  try {
    const res = await axios.post<StripeCheckoutResponse>(`${STRIPE_API_URL}/create-checkout`, { userId });
    return res.data.checkoutUrl;
  } catch (err: any) {
    console.error('Stripe API error:', err);
    throw new Error('Unable to start checkout.');
  }
}
