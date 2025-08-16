/**
 * Central environment variable accessor. Provides required/optional vars with
 * defaults and a consistent getter used throughout the codebase.
 */

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing env var ${name}`);
  }
  return val;
}

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.FRONTEND_URL ||
  'https://onevine.app';

interface EnvVars {
  APP_BASE_URL: string;
  FRONTEND_URL?: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_SUB_PRICE_ID: string;
  STRIPE_SUCCESS_URL: string;
  STRIPE_CANCEL_URL: string;
  STRIPE_20_TOKEN_PRICE_ID?: string;
  STRIPE_50_TOKEN_PRICE_ID?: string;
  STRIPE_100_TOKEN_PRICE_ID?: string;
}

export const env: EnvVars = {
  APP_BASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_PUBLISHABLE_KEY: required('STRIPE_PUBLISHABLE_KEY'),
  STRIPE_SUB_PRICE_ID: required('STRIPE_SUB_PRICE_ID'),
  STRIPE_SUCCESS_URL:
    process.env.STRIPE_SUCCESS_URL ||
    `${APP_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || 'https://example.com/cancel',
  STRIPE_20_TOKEN_PRICE_ID: process.env.STRIPE_20_TOKEN_PRICE_ID,
  STRIPE_50_TOKEN_PRICE_ID: process.env.STRIPE_50_TOKEN_PRICE_ID,
  STRIPE_100_TOKEN_PRICE_ID: process.env.STRIPE_100_TOKEN_PRICE_ID,
};

export function get(name: keyof EnvVars): string {
  const val = env[name];
  if (!val) throw new Error(`Missing env var ${name}`);
  return val;
}

export const projectId = process.env.GCLOUD_PROJECT || '';
