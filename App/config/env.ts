import Constants from 'expo-constants';

type Extra = {
  API_BASE_URL?: string;

  STRIPE_PUBLISHABLE_KEY?: string;
  SUB_PRICE_ID?: string;

  TOKENS_20_PRICE_ID?: string;
  TOKENS_50_PRICE_ID?: string;
  TOKENS_100_PRICE_ID?: string;

  DONATE_2_PRICE_ID?: string;
  DONATE_5_PRICE_ID?: string;
  DONATE_10_PRICE_ID?: string;

  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;

  // optional passthroughs if you read them elsewhere
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  FIREBASE_MSG_SENDER_ID?: string;
  FIREBASE_APP_ID?: string;
  FIREBASE_MEASUREMENT_ID?: string;

  OPENAI_API_KEY?: string;
  LOGGING_MODE?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const ENV = {
  API_BASE_URL: extra.API_BASE_URL ?? '',

  STRIPE_PUBLISHABLE_KEY: extra.STRIPE_PUBLISHABLE_KEY ?? '',
  SUB_PRICE_ID:           extra.SUB_PRICE_ID ?? '',

  TOKENS_20_PRICE_ID:     extra.TOKENS_20_PRICE_ID ?? '',
  TOKENS_50_PRICE_ID:     extra.TOKENS_50_PRICE_ID ?? '',
  TOKENS_100_PRICE_ID:    extra.TOKENS_100_PRICE_ID ?? '',

  DONATE_2_PRICE_ID:      extra.DONATE_2_PRICE_ID ?? '',
  DONATE_5_PRICE_ID:      extra.DONATE_5_PRICE_ID ?? '',
  DONATE_10_PRICE_ID:     extra.DONATE_10_PRICE_ID ?? '',

  STRIPE_SUCCESS_URL:     extra.STRIPE_SUCCESS_URL ?? '',
  STRIPE_CANCEL_URL:      extra.STRIPE_CANCEL_URL ?? '',

  // passthroughs (optional)
  FIREBASE_API_KEY:       extra.FIREBASE_API_KEY ?? '',
  FIREBASE_AUTH_DOMAIN:   extra.FIREBASE_AUTH_DOMAIN ?? '',
  FIREBASE_PROJECT_ID:    extra.FIREBASE_PROJECT_ID ?? '',
  FIREBASE_STORAGE_BUCKET:extra.FIREBASE_STORAGE_BUCKET ?? '',
  FIREBASE_MSG_SENDER_ID: extra.FIREBASE_MSG_SENDER_ID ?? '',
  FIREBASE_APP_ID:        extra.FIREBASE_APP_ID ?? '',
  FIREBASE_MEASUREMENT_ID:extra.FIREBASE_MEASUREMENT_ID ?? '',

  OPENAI_API_KEY:         extra.OPENAI_API_KEY ?? '',
  LOGGING_MODE:           extra.LOGGING_MODE ?? '',
};

export function validateEnv(required: Array<keyof typeof ENV>) {
  const missing: string[] = [];
  for (const k of required) {
    const v = ENV[k];
    if (v === undefined || v === null || String(v).trim() === '') missing.push(k as string);
  }
  return missing;
}
