import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { incrementReligionPoints, awardPointsToUser } from './orgHandlers';
export {
  completeChallenge,
  createMultiDayChallenge,
  completeChallengeDay,
  generateChallenge,
  generateDailyChallenge,
  skipDailyChallenge,
} from './challengeHandlers';
export { askGeminiSimple, confessionalAI, askGeminiV2 } from './journalHandlers';
export {
  updateStreakAndXP,
  getUserProfile,
  seedFirestore,
  backfillUserProfiles,
  updateUserProfileCallable,
  completeSignupAndProfile,
} from './features/users';

/**
 * Stripe (PaymentSheet) — new endpoints
 * - Tokens: PaymentIntent
 * - Subs: PaymentIntent via subscription
 */
export { createTokenPaymentIntent } from './stripefolder/tokens';
export { createSubscriptionPayment } from './stripefolder/subscriptions';

/** ✅ Keep your existing webhook export/name exactly the same */
export { handleStripeWebhookV1 } from './stripefolder/webhook';

export { onCompletedChallengeCreate } from './firestoreArchitecture';
export { cleanLegacySubscriptionFields } from './cleanLegacySubscriptionFields';
