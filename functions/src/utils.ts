import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase';

dotenv.config();
dotenv.config({ path: '.env.functions' });

export function logTokenVerificationError(context: string, token: string | undefined, err: any) {
  logger.error(`${context} token verification failed`, {
    tokenPrefix: token ? token.slice(0, 10) : 'none',
    errorCode: (err as any)?.code,
    message: (err as any)?.message,
  });
}

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
export const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.FRONTEND_URL ||
  'https://onevine.app';
export const STRIPE_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL ||
  `${APP_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
export const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || 'https://example.com/cancel';

export function cleanPriceId(raw: string): string {
  return raw.split('#')[0].trim();
}

export const STRIPE_20_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_20_TOKEN_PRICE_ID || '');
export const STRIPE_50_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_50_TOKEN_PRICE_ID || '');
export const STRIPE_100_TOKEN_PRICE_ID = cleanPriceId(process.env.STRIPE_100_TOKEN_PRICE_ID || '');

export function getTokensFromPriceId(priceId: string): number | null {
  if (priceId === STRIPE_20_TOKEN_PRICE_ID) return 20;
  if (priceId === STRIPE_50_TOKEN_PRICE_ID) return 50;
  if (priceId === STRIPE_100_TOKEN_PRICE_ID) return 100;
  return null;
}

export const CURRENT_PROFILE_SCHEMA = 1;

export function validateSignupProfile(profile: any): Required<Pick<any,
  'email' | 'displayName' | 'username' | 'religion' | 'preferredName'>> & {
  region?: string;
  organization?: string | null;
  pronouns?: string;
  avatarURL?: string;
} {
  if (!profile || typeof profile !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'profile must be an object');
  }

  const requiredFields = [
    'email',
    'displayName',
    'username',
    'religion',
    'preferredName',
  ];

  const sanitized: any = {};
  for (const field of requiredFields) {
    const val = profile[field];
    if (typeof val !== 'string' || !val.trim()) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid ${field}`);
    }
    sanitized[field] = val.trim();
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized.email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  if (!usernameRegex.test(sanitized.username)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid username');
  }

  if (typeof profile.avatarURL === 'string' && profile.avatarURL.trim()) {
    try {
      new URL(profile.avatarURL);
    } catch {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid avatarURL');
    }
    sanitized.avatarURL = profile.avatarURL.trim();
  }

  if ('pronouns' in profile && typeof profile.pronouns === 'string') {
    sanitized.pronouns = profile.pronouns.trim();
  }

  if ('region' in profile) {
    if (typeof profile.region !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'region must be a string');
    }
    sanitized.region = profile.region.trim();
  }

  if ('organization' in profile) {
    if (
      profile.organization !== null &&
      typeof profile.organization !== 'string'
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'organization must be a string or null',
      );
    }
    sanitized.organization = profile.organization ?? null;
  }

  return sanitized;
}

if (!process.env.STRIPE_SUB_PRICE_ID) {
  logger.warn('⚠️ Missing STRIPE_SUB_PRICE_ID in .env');
}

if (!STRIPE_SECRET_KEY) {
  logger.error('❌ STRIPE_SECRET_KEY missing. Set this in your environment.');
} else {
  logger.info('✅ Stripe key loaded');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
} as any);

export async function addTokens(uid: string, amount: number): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
    t.set(
      userRef,
      {
        tokens: current + amount,
        lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function deductTokens(uid: string, amount: number): Promise<boolean> {
  const userRef = db.collection('users').doc(uid);
  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const current = snap.exists ? (snap.data()?.tokens ?? 0) : 0;
      if (current < amount) {
        throw new Error('INSUFFICIENT_TOKENS');
      }
      t.set(
        userRef,
        {
          tokens: current - amount,
          lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return true;
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_TOKENS') {
      return false;
    }
    throw err;
  }
}

export async function updateStreakAndXPInternal(uid: string, type: string) {
  const baseRef = db.collection('users').doc(uid);
  const ref =
    type === 'journal'
      ? db.doc(`users/${uid}/journalStreak/current`)
      : baseRef;

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const now = admin.firestore.Timestamp.now();
    const last: admin.firestore.Timestamp | undefined = data.lastCheckIn;
    const streak = data.streakCount || 0;
    const xp = data.xpPoints || 0;
    const longest = data.longestStreak || 0;

    let newStreak = 1;
    if (last) {
      const diffMs = now.toMillis() - last.toMillis();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 1) {
        newStreak = streak; // same day
      } else if (diffDays < 2) {
        newStreak = streak + 1;
      }
    }
    const xpEarned = 10;
    t.set(
      ref,
      {
        lastCheckIn: now,
        streakCount: newStreak,
        xpPoints: xp + xpEarned,
        longestStreak: Math.max(longest, newStreak),
      },
      { merge: true },
    );
  });
}

export async function findUidByCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const snap = await db
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}
