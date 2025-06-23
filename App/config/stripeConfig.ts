export const STRIPE_SUCCESS_URL = process.env.EXPO_PUBLIC_STRIPE_SUCCESS_URL || 'https://example.com/success';
export const STRIPE_CANCEL_URL = process.env.EXPO_PUBLIC_STRIPE_CANCEL_URL || 'https://example.com/cancel';

export const PRICE_IDS = {
  SUBSCRIPTION: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID || '',
  TOKENS_20: process.env.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID || '',
  TOKENS_50: process.env.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID || '',
  TOKENS_100: process.env.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID || '',
  DONATE_2: process.env.EXPO_PUBLIC_STRIPE_DONATE_2_PRICE_ID || '',
  DONATE_5: process.env.EXPO_PUBLIC_STRIPE_DONATE_5_PRICE_ID || '',
  DONATE_10: process.env.EXPO_PUBLIC_STRIPE_DONATE_10_PRICE_ID || '',
};
