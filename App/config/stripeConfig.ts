import { ENV } from './env';

function cleanPriceId(raw?: string): string {
  return (raw ?? '').split('#')[0].trim();
}

export const STRIPE_SUCCESS_URL =
  ENV.STRIPE_SUCCESS_URL || 'https://example.com/success';
export const STRIPE_CANCEL_URL =
  ENV.STRIPE_CANCEL_URL || 'https://example.com/cancel';

const PRICE_IDS = {
  SUBSCRIPTION: cleanPriceId(ENV.SUB_PRICE_ID),
  TOKENS_20: cleanPriceId(ENV.TOKENS_20_PRICE_ID),
  TOKENS_50: cleanPriceId(ENV.TOKENS_50_PRICE_ID),
  TOKENS_100: cleanPriceId(ENV.TOKENS_100_PRICE_ID),
};

if (!PRICE_IDS.SUBSCRIPTION) {
  console.warn('⚠️ Missing SUB_PRICE_ID');
}

export { PRICE_IDS };

export const ONEVINE_PLUS_PRICE_ID = PRICE_IDS.SUBSCRIPTION;
