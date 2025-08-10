import Constants from 'expo-constants';

type Extra = {
  API_BASE_URL?: string;

  STRIPE_PUBLISHABLE_KEY_TEST?: string;
  STRIPE_PUBLISHABLE_KEY_LIVE?: string;

  SUB_PRICE_ID_TEST?: string;
  SUB_PRICE_ID_LIVE?: string;

  TOKENS_20_PRICE_ID_TEST?: string;
  TOKENS_50_PRICE_ID_TEST?: string;
  TOKENS_100_PRICE_ID_TEST?: string;

  TOKENS_20_PRICE_ID_LIVE?: string;
  TOKENS_50_PRICE_ID_LIVE?: string;
  TOKENS_100_PRICE_ID_LIVE?: string;

  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
// Channel is set by EAS profile (development | preview | production)
const channel = Constants.expoConfig?.updates?.channel ?? 'development';
const isProd = channel === 'production';

export const ENV = {
  CHANNEL: channel,
  IS_PROD: isProd,

  API_BASE_URL: extra.API_BASE_URL ?? '',

  STRIPE_PUBLISHABLE_KEY: isProd ? extra.STRIPE_PUBLISHABLE_KEY_LIVE : extra.STRIPE_PUBLISHABLE_KEY_TEST,
  SUB_PRICE_ID:           isProd ? extra.SUB_PRICE_ID_LIVE          : extra.SUB_PRICE_ID_TEST,

  TOKENS_20_PRICE_ID:     isProd ? extra.TOKENS_20_PRICE_ID_LIVE    : extra.TOKENS_20_PRICE_ID_TEST,
  TOKENS_50_PRICE_ID:     isProd ? extra.TOKENS_50_PRICE_ID_LIVE    : extra.TOKENS_50_PRICE_ID_TEST,
  TOKENS_100_PRICE_ID:    isProd ? extra.TOKENS_100_PRICE_ID_LIVE   : extra.TOKENS_100_PRICE_ID_TEST,

  STRIPE_SUCCESS_URL: extra.STRIPE_SUCCESS_URL ?? '',
  STRIPE_CANCEL_URL:  extra.STRIPE_CANCEL_URL ?? '',
};

export function validateEnv(required: Array<keyof typeof ENV>) {
  const missing: string[] = [];
  for (const k of required) {
    const v = ENV[k];
    if (v === undefined || v === null || String(v).trim() === '') missing.push(k as string);
  }
  return missing;
}
