import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || '';
if (!API_URL) {
  console.warn('⚠️ Missing EXPO_PUBLIC_API_URL in .env');
}

export const ASK_GEMINI_V2 = `${API_URL}/askGeminiV2`;
export const ASK_GEMINI_SIMPLE = `${API_URL}/askGeminiSimple`;
export const GENERATE_CHALLENGE_URL = `${API_URL}/generateChallenge`;
export const CONFESSIONAL_AI_URL = `${API_URL}/confessionalAI`;

export const STRIPE_WEBHOOK_URL = `${API_URL}/handleStripeWebhookV2`; // Optional if you plan to ping it
export const INCREMENT_RELIGION_POINTS_URL = `${API_URL}/incrementReligionPoints`;

// Optional legacy API base (if still using other functions there)
export const API_BASE_URL = API_URL;
