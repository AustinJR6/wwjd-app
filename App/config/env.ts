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
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const ENV = {
  API_BASE_URL: extra.API_BASE_URL ?? '',

  STRIPE_PUBLISHABLE_KEY: extra.STRIPE_PUBLISHABLE_KEY ?? '',

  SUB_PRICE_ID: extra.SUB_PRICE_ID ?? '',

  TOKENS_20_PRICE_ID: extra.TOKENS_20_PRICE_ID ?? '',
  TOKENS_50_PRICE_ID: extra.TOKENS_50_PRICE_ID ?? '',
  TOKENS_100_PRICE_ID: extra.TOKENS_100_PRICE_ID ?? '',

  DONATE_2_PRICE_ID: extra.DONATE_2_PRICE_ID ?? '',
  DONATE_5_PRICE_ID: extra.DONATE_5_PRICE_ID ?? '',
  DONATE_10_PRICE_ID: extra.DONATE_10_PRICE_ID ?? '',
};

export function validateEnv(required: Array<keyof typeof ENV>) {
  const missing: string[] = [];
  for (const k of required) {
    const v = ENV[k];
    if (v === undefined || v === null || String(v).trim() === '')
      missing.push(k as string);
  }
  return missing;
}

