import { defineSecret } from 'firebase-functions/params';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_PUBLISHABLE_KEY = defineSecret('STRIPE_PUBLISHABLE_KEY');
export const STRIPE_SUB_PRICE_ID = defineSecret('STRIPE_SUB_PRICE_ID');
export const STRIPE_20_TOKEN_PRICE_ID = defineSecret('STRIPE_20_TOKEN_PRICE_ID');
export const STRIPE_50_TOKEN_PRICE_ID = defineSecret('STRIPE_50_TOKEN_PRICE_ID');
export const STRIPE_100_TOKEN_PRICE_ID = defineSecret('STRIPE_100_TOKEN_PRICE_ID');

