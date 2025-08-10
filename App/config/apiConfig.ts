import { ENV } from './env';

const API_URL = ENV.API_BASE_URL;
if (!API_URL) {
  console.warn('⚠️ Missing API_BASE_URL');
}

export const GEMINI_API_URL = `${API_URL}/askGeminiV2`;
export const STRIPE_CHECKOUT_URL = `${API_URL}/createStripeCheckout`;
export const TOKEN_CHECKOUT_URL = `${API_URL}/startTokenCheckout`;
export const SUBSCRIPTION_CHECKOUT_URL = `${API_URL}/startSubscriptionCheckout`;
export const CHECKOUT_SESSION_URL = `${API_URL}/createCheckoutSession`;
export const INCREMENT_RELIGION_POINTS_URL = `${API_URL}/incrementReligionPoints`;
