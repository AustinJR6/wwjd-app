import axios from 'axios';
import { STRIPE_CHECKOUT_URL } from '@/config/apiConfig';
import { STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL } from '@/config/stripeConfig';
import { getAuthHeaders } from '@/utils/authUtils';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { logTokenIssue } from '@/services/authService';
import { showPermissionDenied } from '@/utils/gracefulError';

type StripeCheckoutResponse = {
  url: string;
};


export async function createStripeCheckout(
  uid: string,
  options: { type: 'subscription' | 'one-time'; priceId: string }
): Promise<string> {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('createStripeCheckout');
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
    console.warn('❌ Firestore REST error on createStripeCheckout:', err.response?.data || err.message);
    if (err.response?.status === 403) {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      throw new Error('Permission denied');
    }
    throw new Error(err.response?.data?.error || 'Unable to start checkout.');
  }
}


