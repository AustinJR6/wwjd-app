import Constants from 'expo-constants';

function cleanPriceId(raw: string): string {
  return raw.split('#')[0].trim();
}

export const STRIPE_SUCCESS_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_SUCCESS_URL ||
  'https://example.com/success';
export const STRIPE_CANCEL_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_CANCEL_URL ||
  'https://example.com/cancel';

const PRICE_IDS = {
  SUBSCRIPTION: cleanPriceId(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_SUB_PRICE_ID || '',
  ),
  TOKENS_20: cleanPriceId(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_20_TOKEN_PRICE_ID || '',
  ),
  TOKENS_50: cleanPriceId(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_50_TOKEN_PRICE_ID || '',
  ),
  TOKENS_100: cleanPriceId(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_100_TOKEN_PRICE_ID || '',
  ),
};

if (!PRICE_IDS.SUBSCRIPTION) {
  console.warn('⚠️ Missing EXPO_PUBLIC_STRIPE_SUB_PRICE_ID in .env');
}

export { PRICE_IDS };

export const ONEVINE_PLUS_PRICE_ID = PRICE_IDS.SUBSCRIPTION;
