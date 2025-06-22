const BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL;

export const GEMINI_API_URL = `${BASE_URL}/askGeminiV2`;
export const STRIPE_SUB_CHECKOUT_URL = `${BASE_URL}/startSubscriptionCheckout`;
export const STRIPE_TOKEN_CHECKOUT_URL = `${BASE_URL}/startOneTimeTokenCheckout`;
export const INCREMENT_RELIGION_POINTS_URL = `${BASE_URL}/incrementReligionPoints`;
