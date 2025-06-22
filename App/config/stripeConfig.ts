export const STRIPE_SUCCESS_URL = process.env.EXPO_PUBLIC_STRIPE_SUCCESS_URL || 'https://example.com/success';
export const STRIPE_CANCEL_URL = process.env.EXPO_PUBLIC_STRIPE_CANCEL_URL || 'https://example.com/cancel';

export const PRICE_IDS = {
  SUBSCRIPTION: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID || '',
  TOKENS_5: process.env.EXPO_PUBLIC_STRIPE_5_TOKEN_PRICE_ID || '',
  TOKENS_15: process.env.EXPO_PUBLIC_STRIPE_15_TOKEN_PRICE_ID || '',
  TOKENS_40: process.env.EXPO_PUBLIC_STRIPE_40_TOKEN_PRICE_ID || '',
  DONATE_2: process.env.EXPO_PUBLIC_STRIPE_DONATE_2_PRICE_ID || '',
  DONATE_5: process.env.EXPO_PUBLIC_STRIPE_DONATE_5_PRICE_ID || '',
  DONATE_10: process.env.EXPO_PUBLIC_STRIPE_DONATE_10_PRICE_ID || '',
};
