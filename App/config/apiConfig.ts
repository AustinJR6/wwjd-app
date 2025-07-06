import Constants from 'expo-constants';

const API_URL = Constants.expoConfig.extra.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  console.warn('⚠️ Missing EXPO_PUBLIC_API_URL in .env');
}

export const GEMINI_API_URL = `${API_URL}/askGeminiV2`;
export const STRIPE_CHECKOUT_URL = `${API_URL}/createStripeCheckout`;
export const TOKEN_CHECKOUT_URL = `${API_URL}/startTokenCheckout`;
export const SUBSCRIPTION_CHECKOUT_URL = `${API_URL}/startSubscriptionCheckout`;
export const INCREMENT_RELIGION_POINTS_URL = `${API_URL}/incrementReligionPoints`;
