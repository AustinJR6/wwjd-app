import axios from 'axios';
import { STRIPE_CHECKOUT_URL, TOKEN_CHECKOUT_URL, SUBSCRIPTION_CHECKOUT_URL, CHECKOUT_SESSION_URL } from '@/config/apiConfig';
import { STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL } from '@/config/stripeConfig';
import { getAuthHeaders } from '@/utils/authUtils';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { logTokenIssue } from '@/shared/tokenLogger';
import { showPermissionDenied } from '@/utils/gracefulError';

function cleanPriceId(raw: string): string {
  return raw.split('#')[0].trim();
}

type StripeCheckoutResponse = {
  url?: string;
  clientSecret?: string;
  paymentIntent?: string;
  ephemeralKey?: string;
  customerId?: string;
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

  const cleanId = cleanPriceId(options.priceId);
  console.log('Creating Stripe session with:', { uid, priceId: cleanId });

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
      priceId: cleanId,
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
    console.warn('🚫 Stripe Checkout failed — missing uid or priceId', { uid, priceId });
    return '';
  }
  const cleanId = cleanPriceId(priceId);
  console.log('🪙 Starting Stripe checkout', { uid, priceId: cleanId });

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('startTokenCheckout');
    throw new Error('Missing auth token');
  }

  try {
    const payload = { uid, priceId: cleanId };
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(TOKEN_CHECKOUT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    );
    const text = await res.text();
    if (!res.ok) {
      console.warn('❌ Firestore REST error on startTokenCheckout:', text);
      if (res.status === 403) {
        console.warn('Firestore 403 – not a session issue');
        showPermissionDenied();
        throw new Error('Permission denied');
      }
      throw new Error('Unable to start checkout.');
    }
    const data: StripeCheckoutResponse = JSON.parse(text);
    const url = (data as any).checkoutUrl || data.url;
    console.log('🔗 Redirect URL received', url);
    return url;
  } catch (err: any) {
    console.warn('❌ Firestore REST error on startTokenCheckout:', err?.message || err);
    throw new Error(err?.message || 'Unable to start checkout.');
  }
}

export async function createCheckoutSession(
  uid: string,
  priceId: string,
  tokenAmount: number,
): Promise<StripeCheckoutResponse> {
  if (
    typeof uid !== 'string' || !uid.trim() ||
    typeof priceId !== 'string' || !priceId.trim() ||
    typeof tokenAmount !== 'number' || tokenAmount <= 0
  ) {
    console.warn('Missing fields for createCheckoutSession', { uid, priceId, tokenAmount });
    throw new Error('Invalid input');
  }

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('createCheckoutSession');
    throw new Error('Missing auth token');
  }

  try {
    const cleanId = cleanPriceId(priceId);
    const payload = { uid, priceId: cleanId, tokenAmount, mode: 'payment', type: 'token_purchase' };
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(CHECKOUT_SESSION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    );
    const text = await res.text();
    if (!res.ok) {
      console.warn('❌ createCheckoutSession error:', text);
      if (res.status === 403) {
        showPermissionDenied();
        throw new Error('Permission denied');
      }
      throw new Error('Unable to start checkout.');
    }
    const data: StripeCheckoutResponse = JSON.parse(text);
    return data;
  } catch (err: any) {
    console.warn('❌ createCheckoutSession failed:', err?.message || err);
    throw new Error(err?.message || 'Unable to start checkout.');
  }
}

export async function startSubscriptionCheckout(uid: string, priceId: string): Promise<string> {
  if (typeof uid !== 'string' || !uid.trim() || typeof priceId !== 'string' || !priceId.trim()) {
    console.warn('🚫 Stripe Checkout failed — missing uid or priceId', { uid, priceId });
    return '';
  }
  const cleanId = cleanPriceId(priceId);
  console.log('📦 Starting OneVine+ subscription...', { uid, priceId: cleanId });

  let headers;
  try {
    headers = await getAuthHeaders();
  } catch {
    logTokenIssue('startSubscriptionCheckout');
    throw new Error('Missing auth token');
  }

  try {
    const payload = { uid, priceId: cleanId };
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(SUBSCRIPTION_CHECKOUT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    );
    const text = await res.text();
    if (!res.ok) {
      console.warn('❌ Firestore REST error on startSubscriptionCheckout:', text);
      if (res.status === 403) {
        console.warn('Firestore 403 – not a session issue');
        showPermissionDenied();
        throw new Error('Permission denied');
      }
      throw new Error('Unable to start checkout.');
    }
    const data: StripeCheckoutResponse = JSON.parse(text);
    const url = (data as any).checkoutUrl || data.url;
    console.log('🔗 Redirecting to:', url);
    return url;
  } catch (err: any) {
    console.warn('❌ Firestore REST error on startSubscriptionCheckout:', err?.message || err);
    throw new Error(err?.message || 'Unable to start checkout.');
  }
}


