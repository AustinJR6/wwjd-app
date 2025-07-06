export const STRIPE_SUCCESS_URL = process.env.EXPO_PUBLIC_STRIPE_SUCCESS_URL || 'https://example.com/success';
export const STRIPE_CANCEL_URL = process.env.EXPO_PUBLIC_STRIPE_CANCEL_URL || 'https://example.com/cancel';

export const PRICE_IDS = {
  SUBSCRIPTION: process.env.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID || '',
  TOKENS_20: process.env.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID || '',
  TOKENS_50: process.env.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID || '',
  TOKENS_100: process.env.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID || '',
  // Donation price IDs are no longer needed because donations use dynamic amounts
};

export const ONEVINE_PLUS_PRICE_ID = PRICE_IDS.SUBSCRIPTION;
