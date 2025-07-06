import axios from 'axios';
import { STRIPE_CHECKOUT_URL, TOKEN_CHECKOUT_URL, SUBSCRIPTION_CHECKOUT_URL } from '@/config/apiConfig';
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
  email: string,
  options: {
    type: 'subscription' | 'tokens';
    priceId: string;
    quantity?: number;
    returnUrl?: string;
  }
): Promise<string> {
  if (
    typeof uid !== 'string' || !uid.trim() ||
    typeof options.priceId !== 'string' || !options.priceId.trim()
  ) {
    console.warn('Missing uid or priceId for createStripeCheckout', {
      uid,
      priceId: options.priceId,
    });
    throw new Error('Missing uid or priceId');
  }

  console.log('Creating Stripe session with:', { uid, priceId: options.priceId });

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('createStripeCheckout');
    throw new Error('Missing auth token');
  }
  try {
    const payload = {
      uid,
      email,
      priceId: options.priceId,
      type: options.type,
      quantity: options.quantity,
      returnUrl: options.returnUrl ?? STRIPE_SUCCESS_URL,
    };
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post<StripeCheckoutResponse>(STRIPE_CHECKOUT_URL, payload, {
        headers,
      }) as unknown as Promise<Axios.AxiosXHR<StripeCheckoutResponse>>
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

export async function startTokenCheckout(uid: string, priceId: string): Promise<string> {
  if (typeof uid !== 'string' || !uid.trim() || typeof priceId !== 'string' || !priceId.trim()) {
    console.warn('Missing uid or priceId for startTokenCheckout', { uid, priceId });
    throw new Error('Missing uid or priceId');
  }

  console.log('🪙 Starting Stripe checkout', { uid, priceId });

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('startTokenCheckout');
    throw new Error('Missing auth token');
  }

  try {
    const payload = { uid, priceId };
    const res = await axios.post<StripeCheckoutResponse>(TOKEN_CHECKOUT_URL, payload, { headers });
    const url = (res.data as any).checkoutUrl || res.data.url;
    console.log('🔗 Redirect URL received', url);
    return url;
  } catch (err: any) {
    console.warn('❌ Firestore REST error on startTokenCheckout:', err.response?.data || err.message);
    if (err.response?.status === 403) {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      throw new Error('Permission denied');
    }
    throw new Error(err.response?.data?.error || 'Unable to start checkout.');
  }
}

export async function startSubscriptionCheckout(uid: string, priceId: string): Promise<string> {
  if (typeof uid !== 'string' || !uid.trim() || typeof priceId !== 'string' || !priceId.trim()) {
    console.warn('Missing uid or priceId for startSubscriptionCheckout', { uid, priceId });
    throw new Error('Missing uid or priceId');
  }

  console.log('📦 Starting OneVine+ subscription...', { uid, priceId });

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('startSubscriptionCheckout');
    throw new Error('Missing auth token');
  }

  try {
    const payload = { uid, priceId };
    const res = await axios.post<StripeCheckoutResponse>(SUBSCRIPTION_CHECKOUT_URL, payload, { headers });
    const url = (res.data as any).checkoutUrl || res.data.url;
    console.log('🔗 Redirecting to:', url);
    return url;
  } catch (err: any) {
    console.warn('❌ Firestore REST error on startSubscriptionCheckout:', err.response?.data || err.message);
    if (err.response?.status === 403) {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      throw new Error('Permission denied');
    }
    throw new Error(err.response?.data?.error || 'Unable to start checkout.');
  }
}


