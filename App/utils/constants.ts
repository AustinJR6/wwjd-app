const BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL;

export const ASK_GEMINI_V2 = `${BASE_URL}/askGeminiV2`;
export const ASK_GEMINI_SIMPLE = ASK_GEMINI_V2; // alias to unify usage

export const STRIPE_WEBHOOK_URL = `${BASE_URL}/handleStripeWebhookV2`; // Optional if you plan to ping it
export const INCREMENT_RELIGION_POINTS_URL = `${BASE_URL}/incrementReligionPoints`;

// Optional legacy API base (if still using other functions there)
export const API_BASE_URL = BASE_URL;
